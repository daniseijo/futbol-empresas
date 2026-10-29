// Announces upcoming matches: the focus team's on the configured channels, and
// each subscribed team's on the Slack channels that subscribed from its page,
// when each of them asked (src/notify/schedule.ts).
// It only reads the database the sync fills (never the league API) and keeps
// what it sent in `notifications`, so it can run after any sync, as often as
// wanted: a match is announced once per target, and again if its date or venue
// changes.

import { and, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/libsql/migrator";
import { siteConfig } from "@/config/site";
import { db, schema } from "@/db/client";
import { nowInMadrid } from "@/lib/dates";
import { bracketSize, buildKnockout, knockoutLabels } from "@/lib/bracket";
import { fillMissingRounds } from "@/lib/rounds";
import { championsStage, isChampions } from "@/lib/sportspress/champions";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match } from "@/lib/sportspress/types";
import { callUpMessage, fingerprint, pendingCallUps, type CallUp, type CallUpMessage } from "./call-ups";
import { configuredChannels, RevokedWebhookError, slack, subscriptionFooter, type Channel } from "./channels";
import type { Schedule } from "./schedule";
import { decrypt, encryptionKey } from "./secrets";
import { settingsUrl } from "./slack-oauth";
import { pendingByTarget, subscriptionKey, type Target } from "./targets";

type Log = (message: string) => void;

/** A target with what is needed to reach it. */
interface Recipient extends Target {
  /** For the log: "telegram", "sub:3 (#futbol, Acme)". */
  label: string;
  /** Null for the env-configured channels. */
  subscriptionId: number | null;
  /** Built when sending, so a dry run needs no encryption key. */
  open(): Channel;
}

const homeTeam = alias(schema.teams, "home_team");
const awayTeam = alias(schema.teams, "away_team");

/** Matches with each team's current name, as the site shows them (see `selectMatches` in data.ts). */
async function loadMatches(where: SQL | undefined): Promise<Match[]> {
  const rows = await db
    .select({ match: schema.matches, homeTeamName: homeTeam.name, awayTeamName: awayTeam.name })
    .from(schema.matches)
    .leftJoin(homeTeam, eq(homeTeam.id, schema.matches.homeId))
    .leftJoin(awayTeam, eq(awayTeam.id, schema.matches.awayId))
    .where(where);
  return rows.map(({ match: row, homeTeamName, awayTeamName }) => ({
    ...row,
    homeName: homeTeamName ?? row.homeName,
    awayName: awayTeamName ?? row.awayName,
    played: row.played || (row.homeGoals !== null && row.awayGoals !== null),
    scorers: [],
  }));
}

/** A dry run skips the migrations, so before the first real run a table may not exist yet. */
async function tableExists(name: string): Promise<boolean> {
  const [table] = await db.select({ name: sql`name` }).from(sql`sqlite_master`).where(sql`type = 'table' and name = ${name}`);
  return Boolean(table);
}

async function loadRecipients(focusTeamId: number): Promise<Recipient[]> {
  const channels: Recipient[] = configuredChannels().map((channel) => ({
    key: channel.name,
    teamId: focusTeamId,
    label: channel.name,
    subscriptionId: null,
    open: () => channel,
  }));
  const subscriptions = (await tableExists("subscriptions")) ? await db.select().from(schema.subscriptions) : [];
  return [
    ...channels,
    ...subscriptions.map((sub) => {
      const schedule: Schedule = { weekday: sub.notifyWeekday, time: sub.notifyTime };
      return {
        key: subscriptionKey(sub.id),
        teamId: sub.teamId,
        schedule,
        label: `${subscriptionKey(sub.id)} (${sub.channelName}, ${sub.workspaceName})`,
        subscriptionId: sub.id,
        open: () => {
          const key = encryptionKey();
          return slack(decrypt(sub.webhookUrl, key), subscriptionKey(sub.id), subscriptionFooter(schedule, settingsUrl(sub.id, key)));
        },
      };
    }),
  ];
}

/** The app was removed or the channel deleted: forget the subscription and what it was sent. */
async function unsubscribe(recipient: Recipient) {
  if (recipient.subscriptionId === null) return;
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, recipient.subscriptionId));
  await db.delete(schema.notifications).where(eq(schema.notifications.channel, recipient.key));
}

/** What the site knows of a group's matches beyond the API: rounds it left out and knockout rounds. */
interface Place {
  rounds: Map<number, number | null>;
  /** Knockout rounds' short names ("1/4", "F"), for a Champions knockout. */
  labels: Map<number, string>;
}

/**
 * A group's matches this season, as the site reads them: the round the API left out of some
 * (`fillMissingRounds`) and, in a Champions knockout, each match's round, from a bracket of the size the
 * sector's had last season.
 */
async function placesInGroup(match: Match, tree: LeagueTree, seasons: { id: number; name: string }[], now: string): Promise<Place> {
  if (match.groupId === null || match.seasonId === null) return { rounds: new Map(), labels: new Map() };
  const inGroup = (seasonId: number) => and(eq(schema.matches.groupId, match.groupId!), eq(schema.matches.seasonId, seasonId));
  const list = await loadMatches(inGroup(match.seasonId));
  const rounds = new Map(fillMissingRounds(list).map((m) => [m.id, m.round]));
  let labels = new Map<number, string>();
  if (isChampions(match, tree) && list.every((m) => m.round === null)) {
    const season = seasons.find((s) => s.id === match.seasonId);
    const previous = seasons.filter((s) => season && s.name < season.name).sort((a, b) => a.name.localeCompare(b.name)).at(-1);
    const before = previous ? await loadMatches(inGroup(previous.id)) : [];
    const expectedSize = bracketSize(buildKnockout(before, { now: "9999-12-31T00:00" }).brackets);
    labels = knockoutLabels(buildKnockout(list, { now, expectedSize }));
  }
  return { rounds, labels };
}

function describe(message: CallUpMessage): string {
  return [`${message.title}: ${message.matchup}, ${message.when}`, message.venue?.name, message.competition].filter(Boolean).join(", ");
}

export async function runNotify({
  dryRun = false,
  matchId = null,
  to = null,
  log = console.log,
}: { dryRun?: boolean; matchId?: number | null; to?: string | null; log?: Log } = {}) {
  if (to !== null && matchId === null) throw new Error("--to only works with --match");
  // Only when it will write: the tests (--dry-run, --match) also work with a read-only token.
  const writes = !dryRun && matchId === null;
  if (writes) await migrate(db, { migrationsFolder: "drizzle" });
  const focus = await db.query.teams.findFirst({ where: eq(schema.teams.slug, siteConfig.focusTeamSlug) });
  if (!focus) throw new Error(`Focus team "${siteConfig.focusTeamSlug}" is not in the database`);
  const now = nowInMadrid();
  const recipients = await loadRecipients(focus.id);
  // A Champions match says so in its call-up.
  const tree = new LeagueTree(await db.select().from(schema.leagues));
  const seasons = await db.select().from(schema.seasons);
  const places = new Map<string, Promise<Place>>();
  const message = async (callUp: CallUp, teamId: number) => {
    const { match } = callUp;
    const key = `${match.groupId}|${match.seasonId}`;
    if (!places.has(key)) places.set(key, placesInGroup(match, tree, seasons, now));
    const { rounds, labels } = await places.get(key)!;
    const placed = { ...match, round: match.round ?? rounds.get(match.id) ?? null };
    return callUpMessage({ ...callUp, match: placed }, teamId, now, championsStage(placed, tree, labels.get(match.id)));
  };

  // One target failing (a revoked webhook, Slack or Telegram down) never stops
  // the others; the run fails at the end so the job shows it.
  const failures: string[] = [];
  const deliver = async (recipient: Recipient, callUps: CallUp[], record: boolean) => {
    for (const callUp of callUps) {
      const text = await message(callUp, recipient.teamId);
      if (dryRun) {
        log(`Would send to ${recipient.label}: ${describe(text)}`);
        continue;
      }
      try {
        await recipient.open().send(text);
      } catch (error) {
        if (error instanceof RevokedWebhookError && recipient.subscriptionId !== null) {
          log(`${recipient.label}: the webhook is gone (${error.message}), ${record ? "unsubscribed" : "would unsubscribe"}`);
          if (record) await unsubscribe(recipient);
          return;
        }
        log(`${recipient.label}: ${error instanceof Error ? error.message : String(error)}`);
        failures.push(recipient.label);
        return;
      }
      log(`Sent to ${recipient.label}: ${describe(text)}`);
      if (!record) continue;
      // Recorded right after each send: if a later one fails, the next run only retries that one.
      const row = { matchId: callUp.match.id, channel: recipient.key, fingerprint: callUp.fingerprint, sentAt: nowInMadrid() };
      await db
        .insert(schema.notifications)
        .values(row)
        .onConflictDoUpdate({
          target: [schema.notifications.matchId, schema.notifications.channel],
          set: { fingerprint: row.fingerprint, sentAt: row.sentAt },
        });
    }
  };
  const finish = () => {
    if (failures.length > 0) throw new Error(`Could not send to ${failures.join(", ")}`);
  };

  // A test: that match, on the configured channels and the subscriptions of
  // either team (or only the channel `to` names), whatever was sent before, and nothing is recorded.
  if (matchId !== null) {
    const [match] = await loadMatches(eq(schema.matches.id, matchId));
    if (!match) throw new Error(`Match ${matchId} is not in the database`);
    const callUp: CallUp = { match, kind: "new", fingerprint: fingerprint(match) };
    const targets = recipients
      .filter((r) => r.subscriptionId === null || r.teamId === match.homeId || r.teamId === match.awayId)
      .filter((r) => to === null || r.key === to);
    if (to !== null && targets.length === 0) throw new Error(`No channel "${to}" for match ${matchId}`);
    if (targets.length === 0) log(`Would send: ${describe(await message(callUp, focus.id))}`);
    for (const recipient of targets) await deliver(recipient, [callUp], false);
    return finish();
  }

  // The current season's upcoming matches, through the (season, date) index:
  // ~100 rows whatever the number of subscriptions. Filtering by team in SQL
  // made SQLite read every match each team ever played (~15,000 rows for 200 teams).
  const teamIds = new Set([focus.id, ...recipients.map((r) => r.teamId)]);
  const season = [...seasons].sort((a, b) => a.name.localeCompare(b.name)).at(-1);
  const upcoming = season
    ? (
        await loadMatches(
          and(eq(schema.matches.seasonId, season.id), gt(schema.matches.date, now), eq(schema.matches.played, false)),
        )
      ).filter((m) => teamIds.has(m.homeId) || teamIds.has(m.awayId))
    : [];
  if (recipients.length === 0) {
    log("No channel configured (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, or SLACK_WEBHOOK_URL) and no subscription");
    const own = upcoming.filter((m) => m.homeId === focus.id || m.awayId === focus.id);
    for (const callUp of pendingCallUps(own, new Map(), now)) log(`Would send: ${describe(await message(callUp, focus.id))}`);
    return;
  }

  // What was sent about those matches, by the primary key's first column. By
  // channel it read the whole table, which is never pruned; adding the channels
  // too makes SQLite probe every match × channel pair. Rows of other channels
  // are harmless: each target only looks up its own.
  const sent =
    upcoming.length > 0 && (await tableExists("notifications"))
      ? await db
          .select()
          .from(schema.notifications)
          .where(
            inArray(
              schema.notifications.matchId,
              upcoming.map((m) => m.id),
            ),
          )
      : [];
  for (const { target, callUps } of pendingByTarget(recipients, upcoming, sent, now)) {
    if (callUps.length === 0) log(`${target.label}: nothing new`);
    await deliver(target, callUps, !dryRun);
  }
  finish();
}

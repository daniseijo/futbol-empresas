// Announces the focus team's upcoming matches on the configured channels. It
// only reads the database the sync fills (never the league API) and keeps what
// it sent in `notifications`, so it can run after any sync, as often as wanted:
// a match is announced once per channel, and again if its date or venue changes.

import { and, eq, gt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/libsql/migrator";
import { siteConfig } from "@/config/site";
import { db, schema } from "@/db/client";
import { nowInMadrid } from "@/lib/dates";
import type { Match } from "@/lib/sportspress/types";
import { callUpMessage, fingerprint, pendingCallUps, type CallUp, type CallUpMessage } from "./call-ups";
import { configuredChannels, type Channel } from "./channels";

type Log = (message: string) => void;

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

function describe(message: CallUpMessage): string {
  return `${message.title}: ${message.matchup}, ${message.when}${message.venue ? `, ${message.venue.name}` : ""}`;
}

export async function runNotify({
  dryRun = false,
  matchId = null,
  log = console.log,
}: { dryRun?: boolean; matchId?: number | null; log?: Log } = {}) {
  // Only when it will write: the tests (--dry-run, --match) also work with a read-only token.
  if (!dryRun && matchId === null) await migrate(db, { migrationsFolder: "drizzle" });
  const team = await db.query.teams.findFirst({ where: eq(schema.teams.slug, siteConfig.focusTeamSlug) });
  if (!team) throw new Error(`Focus team "${siteConfig.focusTeamSlug}" is not in the database`);
  const now = nowInMadrid();
  const channels = configuredChannels();
  const send = async (channel: Channel | null, callUp: CallUp) => {
    const message = callUpMessage(callUp, team.id, now);
    if (channel && !dryRun) await channel.send(message);
    log(`${channel && !dryRun ? `Sent to ${channel.name}` : "Would send"}: ${describe(message)}`);
  };

  // A test: that match, whatever was sent before, and nothing is recorded.
  if (matchId !== null) {
    const [match] = await loadMatches(eq(schema.matches.id, matchId));
    if (!match) throw new Error(`Match ${matchId} is not in the database`);
    const callUp: CallUp = { match, kind: "new", fingerprint: fingerprint(match) };
    if (channels.length === 0) await send(null, callUp);
    for (const channel of channels) await send(channel, callUp);
    return;
  }

  const upcoming = await loadMatches(
    and(
      or(eq(schema.matches.homeId, team.id), eq(schema.matches.awayId, team.id)),
      eq(schema.matches.played, false),
      gt(schema.matches.date, now),
    ),
  );
  if (channels.length === 0) {
    log("No channel configured (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, or SLACK_WEBHOOK_URL)");
    for (const callUp of pendingCallUps(upcoming, new Map(), now)) await send(null, callUp);
    return;
  }

  // A dry run skips the migrations, so before the first real run the table may not exist yet: nothing was sent.
  const [table] = await db.select({ name: sql`name` }).from(sql`sqlite_master`).where(sql`type = 'table' and name = 'notifications'`);
  for (const channel of channels) {
    const rows = table ? await db.select().from(schema.notifications).where(eq(schema.notifications.channel, channel.name)) : [];
    const pending = pendingCallUps(upcoming, new Map(rows.map((r) => [r.matchId, r.fingerprint])), now);
    if (pending.length === 0) log(`${channel.name}: nothing new`);
    for (const callUp of pending) {
      await send(channel, callUp);
      if (dryRun) continue;
      // Recorded right after each send: if a later one fails, the next run only retries that one.
      const row = { matchId: callUp.match.id, channel: channel.name, fingerprint: callUp.fingerprint, sentAt: nowInMadrid() };
      await db
        .insert(schema.notifications)
        .values(row)
        .onConflictDoUpdate({
          target: [schema.notifications.matchId, schema.notifications.channel],
          set: { fingerprint: row.fingerprint, sentAt: row.sentAt },
        });
    }
  }
}

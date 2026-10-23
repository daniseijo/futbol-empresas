// API → database sync, progressive and resumable.
//
// Each run first does the cheap, urgent work (catalog and changes since the
// last run) and then advances the initial backfill in priority order until its
// time budget runs out. Progress is saved after every unit (a page of matches,
// a team), so if the API fails or time runs out, the next run picks up where
// this one stopped. The site works with partial data.

import { and, desc, eq, getTableColumns, gte, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { siteConfig } from "@/config/site";
import { db, schema } from "@/db/client";
import { addDays, nowInMadrid } from "@/lib/dates";
import { PAGE_CONCURRENCY, SportsPressError } from "@/lib/sportspress/client";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Season } from "@/lib/sportspress/types";
import {
  fetchLeagues,
  fetchMatchesPage,
  fetchMatchVideo,
  fetchNews,
  fetchPlayerNames,
  fetchSeasons,
  fetchSquad,
  fetchTeamDetail,
  fetchTeams,
  fetchTournaments,
  fetchYoutubeInfo,
  type LeagueLookup,
  type MatchPlayerRow,
  type MatchRow,
} from "./fetch";

const BATCH = 200;
/** Overlap when asking for changes since the last sync, in case something changed during it. */
const OVERLAP_MINUTES = 60;

type Log = (message: string) => void;

interface Context {
  log: Log;
  startedAt: string;
  deadline: number | null;
  seasons: Season[];
  current: Season;
  lookup: LeagueLookup;
  /** Rows written (to know whether the site needs revalidating). */
  writes: number;
  /** Something the header search shows changed (see `getSearchIndex`). */
  searchChanged: boolean;
}

const hasTime = (ctx: Context) => ctx.deadline === null || Date.now() < ctx.deadline;

// --- Database helpers ---------------------------------------------------------------

/** INSERT ... ON CONFLICT DO UPDATE with every column the rows carry. */
async function upsert<T extends SQLiteTable>(table: T, rows: T["$inferInsert"][], target: SQLiteTable["_"]["columns"][string][]) {
  if (rows.length === 0) return;
  const columns = getTableColumns(table);
  const keys = Object.keys(rows[0]) as (keyof typeof columns & string)[];
  const set = Object.fromEntries(keys.map((key) => [key, sql.raw(`excluded."${columns[key].name}"`)])) as Record<string, SQL>;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db
      .insert(table)
      .values(rows.slice(i, i + BATCH))
      .onConflictDoUpdate({ target, set });
  }
}

async function getState(key: string): Promise<string | null> {
  const row = await db.query.syncState.findFirst({ where: eq(schema.syncState.key, key) });
  return row?.value ?? null;
}

async function setState(key: string, value: string) {
  await upsert(schema.syncState, [{ key, value }], [schema.syncState.key]);
}

function minusMinutes(stamp: string, minutes: number): string {
  const date = new Date(`${stamp}:00Z`);
  date.setUTCMinutes(date.getUTCMinutes() - minutes);
  return date.toISOString().slice(0, 19);
}

/** Lineup players without a `players` row yet, waiting for `backfillPlayerNames`. */
const PENDING_NAMES = "player-names:pending";
/** Set once a scan of every lineup finds no unknown player; after that only the queue is checked. */
const NAMES_SCANNED = "backfill:player-names";

async function pendingNames(): Promise<number[]> {
  return JSON.parse((await getState(PENDING_NAMES)) ?? "[]") as number[];
}

/** The ids, without repeats, that have no `players` row: a primary key lookup each. */
async function withoutRow(playerIds: number[]): Promise<number[]> {
  const ids = [...new Set(playerIds)];
  const known = new Set<number>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const rows = await db
      .select({ id: schema.players.id })
      .from(schema.players)
      .where(inArray(schema.players.id, ids.slice(i, i + BATCH)));
    for (const row of rows) known.add(row.id);
  }
  return ids.filter((id) => !known.has(id));
}

/**
 * Queues the players of the lineups just saved who have no `players` row:
 * a primary key lookup each, instead of `backfillPlayerNames` scanning every
 * lineup on every run (~550,000 rows read). Kept in the database so a run that
 * stops before fetching the names leaves them for the next one.
 */
async function queueUnknownPlayers(playerIds: number[]) {
  const unknown = await withoutRow(playerIds);
  if (unknown.length === 0) return;
  await setState(PENDING_NAMES, JSON.stringify([...new Set([...(await pendingNames()), ...unknown])]));
}

/**
 * Records each player's latest team from the matches just saved, with the
 * dates already in hand: a primary key lookup per player, not a read of their
 * lineups. Players without a row yet are skipped; `fillMissingTeams` covers
 * them once `backfillPlayerNames` or a squad creates it.
 */
async function recordLatestTeams(ctx: Context, rows: { match: MatchRow; lineups: MatchPlayerRow[] }[]) {
  const latest = new Map<number, { teamId: number; date: string }>();
  for (const { match, lineups } of rows) {
    for (const line of lineups) {
      const seen = latest.get(line.playerId);
      if (!seen || seen.date <= match.date) latest.set(line.playerId, { teamId: line.teamId, date: match.date });
    }
  }
  const p = schema.players;
  const ids = [...latest.keys()];
  const current = new Map<number, { name: string; lastTeamId: number | null; lastMatchDate: string | null }>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const found = await db
      .select({ id: p.id, name: p.name, lastTeamId: p.lastTeamId, lastMatchDate: p.lastMatchDate })
      .from(p)
      .where(inArray(p.id, ids.slice(i, i + BATCH)));
    for (const row of found) current.set(row.id, row);
  }
  // One statement per team and date, all sent at once.
  const groups = new Map<string, { teamId: number; date: string; ids: number[] }>();
  for (const [playerId, { teamId, date }] of latest) {
    const row = current.get(playerId);
    if (!row || (row.lastMatchDate !== null && row.lastMatchDate > date)) continue; // no row yet, or a later match is recorded
    if (row.lastTeamId === teamId && row.lastMatchDate === date) continue;
    if (row.lastTeamId !== teamId && row.name) ctx.searchChanged = true;
    const key = `${teamId} ${date}`;
    if (!groups.has(key)) groups.set(key, { teamId, date, ids: [] });
    groups.get(key)!.ids.push(playerId);
  }
  const statements = [...groups.values()].map(({ teamId, date, ids }) =>
    db.update(p).set({ lastTeamId: teamId, lastMatchDate: date }).where(inArray(p.id, ids)),
  );
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    await db.batch(chunk as [(typeof chunk)[number], ...typeof chunk]);
  }
}

/**
 * Latest team of players whose row was created after their lineups were saved.
 * Only rows without a match date and with some lineup are worked out from the
 * lineups, so a player who has not played keeps their squad's team.
 */
async function fillMissingTeams(playerIds: number[]): Promise<number> {
  const ids = [...new Set(playerIds)];
  let changed = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const result = await db.run(sql`
      UPDATE players SET (last_team_id, last_match_date) = (
        SELECT mp.team_id, m.date FROM match_players mp JOIN matches m ON m.id = mp.match_id
        WHERE mp.player_id = players.id ORDER BY m.date DESC, m.id DESC LIMIT 1
      )
      WHERE id IN (${sql.join(ids.slice(i, i + BATCH), sql`, `)})
        AND last_match_date IS NULL
        AND EXISTS (SELECT 1 FROM match_players WHERE player_id = players.id)`);
    changed += result.rowsAffected;
  }
  return changed;
}

async function saveMatches(ctx: Context, rows: { match: MatchRow; lineups: MatchPlayerRow[] }[]): Promise<Set<number>> {
  const touched = new Set<number>();
  if (rows.length === 0) return touched;
  await upsert(
    schema.matches,
    rows.map((r) => r.match),
    [schema.matches.id],
  );
  await db.delete(schema.matchPlayers).where(
    inArray(
      schema.matchPlayers.matchId,
      rows.map((r) => r.match.id),
    ),
  );
  const lineups = rows.flatMap((r) => r.lineups);
  for (let i = 0; i < lineups.length; i += BATCH) await db.insert(schema.matchPlayers).values(lineups.slice(i, i + BATCH));
  await queueUnknownPlayers(lineups.map((l) => l.playerId));
  await recordLatestTeams(ctx, rows);
  for (const { match } of rows) if (match.seasonId === ctx.current.id) touched.add(match.homeId).add(match.awayId);
  ctx.writes += rows.length;
  return touched;
}

// --- Units of work ------------------------------------------------------------------

async function syncTeamDetail(ctx: Context, teamId: number) {
  const detail = await fetchTeamDetail(teamId);
  const video = detail.youtubeUrl ? await fetchYoutubeInfo(detail.youtubeUrl) : null;
  await db
    .update(schema.teams)
    .set({ ...detail, youtubeTitle: video?.title ?? null, youtubeThumbnailUrl: video?.thumbnailUrl ?? null, detailSyncedAt: ctx.startedAt })
    .where(eq(schema.teams.id, teamId));
  ctx.writes += 1;
}

async function syncSquad(ctx: Context, teamId: number) {
  const team = await db.query.teams.findFirst({ where: eq(schema.teams.id, teamId) });
  if (!team) return;
  const { squad, players } = await fetchSquad(team.id, team.listIds);
  await db.delete(schema.squadPlayers).where(eq(schema.squadPlayers.teamId, team.id));
  await upsert(schema.squadPlayers, squad, [schema.squadPlayers.teamId, schema.squadPlayers.playerId]);
  const p = schema.players;
  const ids = squad.map((s) => s.playerId);
  const before = new Map(
    (await db.select({ id: p.id, name: p.name, photoUrl: p.photoUrl, lastTeamId: p.lastTeamId, lastMatchDate: p.lastMatchDate }).from(p).where(inArray(p.id, ids))).map(
      (row) => [row.id, row],
    ),
  );
  await upsert(p, players, [p.id]);
  for (const { id, name, photoUrl } of players) {
    const old = id === undefined ? undefined : before.get(id);
    if (name && (!old || old.name !== name || old.photoUrl !== (photoUrl ?? null))) ctx.searchChanged = true;
  }
  // A squad can bring a player's first row, after their lineups were saved;
  // whoever has not played yet takes this team.
  if ((await fillMissingTeams(ids)) > 0) ctx.searchChanged = true;
  const newcomers = ids.filter((id) => {
    const old = before.get(id);
    return !old || (old.lastMatchDate === null && old.lastTeamId !== team.id);
  });
  if (newcomers.length > 0) {
    await db.update(p).set({ lastTeamId: team.id }).where(and(inArray(p.id, newcomers), isNull(p.lastMatchDate)));
    ctx.searchChanged = true;
  }
  await db.update(schema.teams).set({ squadSyncedAt: ctx.startedAt }).where(eq(schema.teams.id, team.id));
  ctx.writes += 1;
}

// --- Initial backfill tasks (in priority order) --------------------------------------

/** Every page of a season's matches, with a page cursor. */
async function backfillSeasonMatches(ctx: Context, season: Season): Promise<boolean> {
  const key = `backfill:matches:${season.id}`;
  const state = await getState(key);
  if (state === "done") return true;
  let page = state ? Number(state) : 1;
  while (hasTime(ctx)) {
    let result;
    try {
      result = await fetchMatchesPage({ seasonId: season.id }, page, ctx.lookup);
    } catch (error) {
      // Page out of range (matches were deleted): the season is complete.
      if (error instanceof SportsPressError && error.status === 400) break;
      throw error;
    }
    await saveMatches(ctx, result.rows);
    ctx.log(`Matches ${season.name}: page ${page}/${result.totalPages}`);
    if (page >= result.totalPages) break;
    page += 1;
    await setState(key, String(page));
  }
  if (!hasTime(ctx)) return false;
  await setState(key, "done");
  return true;
}

/** Processes teams one by one; the query already skips finished ones, so it is resumable. */
async function forEachTeam(ctx: Context, label: string, teamIds: number[], work: (teamId: number) => Promise<void>): Promise<boolean> {
  for (const [index, teamId] of teamIds.entries()) {
    if (!hasTime(ctx)) return false;
    await work(teamId);
    if ((index + 1) % 5 === 0 || index + 1 === teamIds.length) ctx.log(`${label}: ${index + 1}/${teamIds.length}`);
  }
  return true;
}

function currentSeasonTeams(ctx: Context) {
  return sql`exists (select 1 from json_each(${schema.teams.seasonIds}) where value = ${ctx.current.id})`;
}

async function pendingTeams(
  ctx: Context,
  column: typeof schema.teams.detailSyncedAt | typeof schema.teams.squadSyncedAt,
  onlyIds?: number[],
) {
  const rows = await db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(and(currentSeasonTeams(ctx), isNull(column), onlyIds ? inArray(schema.teams.id, onlyIds) : undefined))
    .orderBy(schema.teams.id);
  return rows.map((r) => r.id);
}

/** The focus team and its group rivals: what the home page shows. */
async function focusTeamIds(ctx: Context): Promise<number[]> {
  const focus = await db.query.teams.findFirst({ where: eq(schema.teams.slug, siteConfig.focusTeamSlug) });
  if (!focus) return [];
  const groups = await db
    .selectDistinct({ groupId: schema.matches.groupId })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.seasonId, ctx.current.id),
        sql`(${schema.matches.homeId} = ${focus.id} or ${schema.matches.awayId} = ${focus.id})`,
      ),
    );
  const groupIds = groups.map((g) => g.groupId).filter((id): id is number => id !== null);
  if (groupIds.length === 0) return [focus.id];
  const rivals = await db
    .select({ home: schema.matches.homeId, away: schema.matches.awayId })
    .from(schema.matches)
    .where(and(eq(schema.matches.seasonId, ctx.current.id), inArray(schema.matches.groupId, groupIds)));
  return [...new Set([focus.id, ...rivals.flatMap((r) => [r.home, r.away])])];
}

/** Downloads and stores the names of these players. */
async function storePlayerNames(ctx: Context, ids: number[]) {
  const names = await fetchPlayerNames(ids);
  // Players the API no longer returns (deleted or private) are stored without
  // a name so they are not requested again on every run.
  const missing = ids.filter((id) => !names.some((n) => n.id === id)).map((id) => ({ id, name: "" }));
  await upsert(schema.players, [...names, ...missing], [schema.players.id]);
  await fillMissingTeams(ids);
  if (names.some((n) => n.name)) ctx.searchChanged = true;
  ctx.writes += names.length;
  ctx.log(`Players: ${names.length} new names`);
}

/**
 * Names of players who appear in lineups and are not known yet.
 * Until a scan of every lineup has found none (the initial backfill), it scans
 * them, which reads ~550,000 rows each time; after that it only takes the
 * players `saveMatches` queued.
 * `withStats`: during the scan, only those with something to show (goals,
 * assists, awards), which are the ones on the home page. `/players` takes
 * ~10 s per call, so the rest get lower priority.
 */
async function backfillPlayerNames(ctx: Context, { withStats }: { withStats: boolean }): Promise<boolean> {
  if ((await getState(NAMES_SCANNED)) === "done") {
    while (hasTime(ctx)) {
      const queue = await pendingNames();
      if (queue.length === 0) return true;
      const batch = queue.slice(0, 100);
      // A squad may have created some rows meanwhile: storing "" over their name would erase it.
      const ids = await withoutRow(batch);
      if (ids.length > 0) await storePlayerNames(ctx, ids);
      const done = new Set(batch);
      await setState(PENDING_NAMES, JSON.stringify((await pendingNames()).filter((id) => !done.has(id))));
    }
    return false;
  }
  const mp = schema.matchPlayers;
  while (hasTime(ctx)) {
    const rows = await db
      .selectDistinct({ id: mp.playerId })
      .from(mp)
      .leftJoin(schema.players, eq(schema.players.id, mp.playerId))
      .where(
        and(
          isNull(schema.players.id),
          withStats ? sql`(${mp.goals} > 0 or ${mp.assists} > 0 or ${mp.crack} or ${mp.dandy})` : undefined,
        ),
      )
      .limit(100);
    if (rows.length === 0) {
      if (!withStats) {
        // Every lineup player is known: the queue (which the scan covered) is all there is from now on.
        await setState(PENDING_NAMES, "[]");
        await setState(NAMES_SCANNED, "done");
      }
      return true;
    }
    await storePlayerNames(
      ctx,
      rows.map((r) => r.id),
    );
  }
  return false;
}

/** A match without a video is checked again at most every 2 hours. */
const VIDEO_RECHECK_MINUTES = 2 * 60;
/** Highlights come out a day or two later; after two weeks they are no longer checked as often. */
const VIDEO_RECENT_DAYS = 14;
/** Web pages take several seconds: fetch as many at once as the client allows. */
const VIDEO_CONCURRENCY = PAGE_CONCURRENCY;
/** Progress line every so many matches (one round of pages, ~15-20 s). */
const VIDEO_LOG_EVERY = VIDEO_CONCURRENCY;

/** Matches whose video still has to be checked (see `backfillMatchVideos`). */
function videoPending(ctx: Context, { current }: { current: boolean }) {
  const m = schema.matches;
  return current
    ? and(
        eq(m.played, true),
        eq(m.seasonId, ctx.current.id),
        isNull(m.videoId),
        or(
          isNull(m.videoCheckedAt),
          and(
            gte(m.date, addDays(ctx.startedAt, -VIDEO_RECENT_DAYS)),
            lt(m.videoCheckedAt, minusMinutes(ctx.startedAt, VIDEO_RECHECK_MINUTES)),
          ),
        ),
      )
    : and(eq(m.played, true), isNull(m.videoCheckedAt));
}

/**
 * Looks for the video highlights on each match's web page (the API lacks them).
 * `current`: played matches of the current season without a video. Those never
 * checked, always; those from the last two weeks, again every 2 hours (the
 * video comes out a day or two after the match).
 * Otherwise: any played match that was never checked (the archive).
 */
async function backfillMatchVideos(ctx: Context, { current }: { current: boolean }): Promise<boolean> {
  const m = schema.matches;
  const where = videoPending(ctx, { current });
  let found = 0;
  let checked = 0;
  while (hasTime(ctx)) {
    const rows = await db.select({ id: m.id }).from(m).where(where).orderBy(desc(m.date)).limit(20);
    if (rows.length === 0) break;
    for (let i = 0; i < rows.length && hasTime(ctx); i += VIDEO_CONCURRENCY) {
      await Promise.all(
        rows.slice(i, i + VIDEO_CONCURRENCY).map(async ({ id }) => {
          const video = await fetchMatchVideo(id).catch((error) => {
            if (error instanceof SportsPressError) return null; // page deleted or unpublished
            throw error;
          });
          await db
            .update(m)
            .set({ videoId: video?.id ?? null, videoTitle: video?.title ?? null, videoCheckedAt: ctx.startedAt })
            .where(eq(m.id, id));
          checked += 1;
          if (video) {
            found += 1;
            ctx.writes += 1;
          }
        }),
      );
      if (checked % VIDEO_LOG_EVERY === 0) ctx.log(`Videos${current ? "" : " (archive)"}: ${found} found in ${checked} matches`);
    }
  }
  if (checked % VIDEO_LOG_EVERY !== 0) ctx.log(`Videos${current ? "" : " (archive)"}: ${found} found in ${checked} matches`);
  return hasTime(ctx);
}

async function countMigrations(): Promise<number> {
  const rows = await db.all<{ n: number }>(sql`select count(*) as n from __drizzle_migrations`).catch(() => [{ n: 0 }]);
  return rows[0]?.n ?? 0;
}

async function countMatches(where: SQL | undefined): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(schema.matches).where(where);
  return row?.n ?? 0;
}

// --- Orchestration ------------------------------------------------------------------

export interface SyncResult {
  writes: number;
  /** The header search's index has to be rebuilt. */
  searchChanged: boolean;
  pending: string[];
  seconds: number;
}

export async function runSync({
  reset = false,
  budgetSeconds = 0,
  matchIds = [],
  log = console.log,
}: { reset?: boolean; budgetSeconds?: number; matchIds?: number[]; log?: Log } = {}): Promise<SyncResult> {
  const started = Date.now();
  const migrationsBefore = await countMigrations();
  await migrate(db, { migrationsFolder: "drizzle" });
  const migrationsAfter = await countMigrations();
  if (reset) {
    await db.delete(schema.syncState);
    await db.update(schema.teams).set({ detailSyncedAt: null, squadSyncedAt: null });
    log("Backfill state reset: everything will be downloaded again");
  }

  // Catalog: seasons and the competition tree (3 calls, always).
  const seasons = (await fetchSeasons()).sort((a, b) => a.name.localeCompare(b.name));
  const leagues = await fetchLeagues();
  await upsert(schema.seasons, seasons, [schema.seasons.id]);
  await upsert(schema.leagues, leagues, [schema.leagues.id]);
  const tree = new LeagueTree(leagues);
  const ctx: Context = {
    log,
    startedAt: nowInMadrid(),
    deadline: budgetSeconds > 0 ? started + budgetSeconds * 1000 : null,
    seasons,
    current: seasons[seasons.length - 1],
    lookup: { deepest: (ids) => tree.deepest(ids)?.id ?? null, root: (id) => tree.competitionOf(id)?.id ?? null },
    writes: 0,
    // A migration can change anything the index reads (as the one adding `last_team_id` did).
    searchChanged: migrationsAfter > migrationsBefore,
  };
  log(`Current season ${ctx.current.name}${budgetSeconds ? ` · budget ${budgetSeconds} s` : ""}`);

  // 0. Matches requested explicitly (pnpm sync -- --matches=1,2,3).
  for (let i = 0; i < matchIds.length; i += 50) {
    const result = await fetchMatchesPage({ ids: matchIds.slice(i, i + 50) }, 1, ctx.lookup);
    await saveMatches(ctx, result.rows);
    log(`Matches downloaded again: ${result.rows.map((r) => r.match.id).join(", ")}`);
  }

  // 1. Changes since the last run (cheap: only what was modified).
  const since = await getState("changes");
  if (since) {
    const after = minusMinutes(since, OVERLAP_MINUTES);
    const teams = await fetchTeams(after);
    await upsert(schema.teams, teams, [schema.teams.id]);
    if (teams.length > 0) ctx.searchChanged = true; // name, crest or seasons may have changed
    const touched = new Set(teams.map((t) => t.id));
    let matches = 0;
    for (let page = 1, total = 1; page <= total; page += 1) {
      const result = await fetchMatchesPage({ modifiedAfter: after }, page, ctx.lookup);
      total = result.totalPages;
      matches += result.rows.length;
      for (const id of await saveMatches(ctx, result.rows)) touched.add(id);
    }
    log(`Changes since ${since}: ${teams.length} teams updated, ${matches} matches updated (${touched.size} squads to refresh)`);
    for (const teamId of teams.map((t) => t.id)) await syncTeamDetail(ctx, teamId);
    const squadsStarted = Date.now();
    for (const teamId of touched) await syncSquad(ctx, teamId);
    if (touched.size > 0) log(`Squads refreshed: ${touched.size} in ${Math.round((Date.now() - squadsStarted) / 1000)} s`);
  } else if (!(await getState("backfill:teams"))) {
    const teams = await fetchTeams();
    await upsert(schema.teams, teams, [schema.teams.id]);
    ctx.searchChanged = true;
    await setState("backfill:teams", "done");
    log(`Teams: ${teams.length}`);
  }
  await setState("changes", ctx.startedAt);
  await upsert(schema.tournaments, await fetchTournaments(ctx.current.id), [schema.tournaments.id]);
  await upsert(schema.news, await fetchNews(10), [schema.news.id]);

  // 2. Initial backfill by priority, until the budget runs out. The optional
  // third element says how much a paused task has left, for the log.
  type Task = [string, () => Promise<boolean>, (() => Promise<string>)?];
  const teamsLeft = async (column: typeof schema.teams.detailSyncedAt | typeof schema.teams.squadSyncedAt) =>
    `${(await pendingTeams(ctx, column)).length} teams left`;
  const videosLeft = async (current: boolean) => `${await countMatches(videoPending(ctx, { current }))} matches left`;
  const tasks: Task[] = [
    [`Matches ${ctx.current.name}`, () => backfillSeasonMatches(ctx, ctx.current)],
    [
      "Focus team and its group",
      async () => {
        const ids = await focusTeamIds(ctx);
        const details = await forEachTeam(ctx, "Details (group)", await pendingTeams(ctx, schema.teams.detailSyncedAt, ids), (id) => syncTeamDetail(ctx, id));
        const squads = await forEachTeam(ctx, "Squads (group)", await pendingTeams(ctx, schema.teams.squadSyncedAt, ids), (id) => syncSquad(ctx, id));
        return details && squads;
      },
    ],
    ["Scorer names", () => backfillPlayerNames(ctx, { withStats: true })],
    ["Current season videos", () => backfillMatchVideos(ctx, { current: true }), () => videosLeft(true)],
    [
      "Team details",
      async () =>
        forEachTeam(ctx, "Team details", await pendingTeams(ctx, schema.teams.detailSyncedAt), (id) => syncTeamDetail(ctx, id)),
      () => teamsLeft(schema.teams.detailSyncedAt),
    ],
    [
      "Squads",
      async () => forEachTeam(ctx, "Squads", await pendingTeams(ctx, schema.teams.squadSyncedAt), (id) => syncSquad(ctx, id)),
      () => teamsLeft(schema.teams.squadSyncedAt),
    ],
    ["Lineup names", () => backfillPlayerNames(ctx, { withStats: false })],
    [
      "Past season champions",
      async () => {
        if ((await getState("backfill:tournaments")) === "done") return true;
        for (const season of ctx.seasons) await upsert(schema.tournaments, await fetchTournaments(season.id), [schema.tournaments.id]);
        await setState("backfill:tournaments", "done");
        return true;
      },
    ],
    ...[...ctx.seasons]
      .reverse()
      .slice(1)
      .map((season): Task => [`Matches ${season.name}`, () => backfillSeasonMatches(ctx, season)]),
    ["Lineup names (archive)", () => backfillPlayerNames(ctx, { withStats: false })],
    ["Videos (archive)", () => backfillMatchVideos(ctx, { current: false }), () => videosLeft(false)],
  ];

  const pending: string[] = [];
  for (const [name, task, remaining] of tasks) {
    if (hasTime(ctx) && (await task())) continue;
    pending.push(remaining ? `${name} (${await remaining()})` : name);
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  if (ctx.searchChanged) log("Search index: to be rebuilt");
  log(pending.length ? `Paused after ${seconds} s. Pending: ${pending.join(", ")}` : `All up to date in ${seconds} s`);
  return { writes: ctx.writes, searchChanged: ctx.searchChanged, pending, seconds };
}

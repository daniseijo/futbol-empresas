// Database reads for the pages. They never call the league API: the sync does
// that (src/sync). Reads are cached with "use cache" and the sync invalidates
// them through the "data" tag.

import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema } from "@/db/client";
import { shortenUrl, type SearchIndexPayload } from "./search";
import type {
  League,
  LineupPlayer,
  Match,
  MatchDetail,
  Position,
  Scorer,
  Season,
  SquadPlayer,
  Team,
  TeamSummary,
} from "./sportspress/types";

export const DATA_TAG = "data";
/** The header search's index, revalidated only when the sync changes what it shows. */
export const SEARCH_TAG = "search";

/**
 * The `players` columns the pages read. Listed, not `select()`ed whole, so a
 * column added by a migration does not break the site in the window between
 * deploying and the sync applying it to Turso.
 */
const playerColumns = { id: schema.players.id, name: schema.players.name, photoUrl: schema.players.photoUrl };

/** Madrid time of the last sync that pulled the API changes, or null if it never ran. */
export async function getLastSync(): Promise<string | null> {
  "use cache";
  cacheLife("results");
  cacheTag(DATA_TAG);
  const row = await db.query.syncState.findFirst({ where: eq(schema.syncState.key, "changes") });
  return row?.value ?? null;
}

export async function getSeasons(): Promise<Season[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  const rows = await db.select().from(schema.seasons);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCurrentSeason(): Promise<Season> {
  const seasons = await getSeasons();
  return seasons[seasons.length - 1];
}

export async function getLeagues(): Promise<League[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  return db.select().from(schema.leagues);
}

/** Group–season pairs with matches (the group is each match's deepest node). */
export async function getGroupSeasons(): Promise<{ groupId: number; seasonId: number }[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  const m = schema.matches;
  const rows = await db.selectDistinct({ groupId: m.groupId, seasonId: m.seasonId }).from(m);
  return rows.filter((row): row is { groupId: number; seasonId: number } => row.groupId !== null && row.seasonId !== null);
}

export async function getTeams(): Promise<TeamSummary[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  const rows = await db
    .select({
      id: schema.teams.id,
      slug: schema.teams.slug,
      name: schema.teams.name,
      logoUrl: schema.teams.logoUrl,
      seasonIds: schema.teams.seasonIds,
      leagueIds: schema.teams.leagueIds,
    })
    .from(schema.teams);
  return rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Image URLs on the league's site share this prefix; the search index leaves it out. */
const UPLOADS = "https://www.futbolempresas.es/wp-content/uploads/";

/**
 * Every team and every player with a name, for the header search, with the
 * team the sync records for each player (`lastTeamId`). It is rebuilt only
 * when the sync reports a change to what it shows (SEARCH_TAG), so it reads
 * teams and seasons itself: calling the cached getters would also tie it to
 * DATA_TAG, which every sync with any write invalidates. Each rebuild reads
 * ~15,000 rows; a search reads none.
 */
export async function getSearchIndex(): Promise<SearchIndexPayload> {
  "use cache";
  // Long enough that only the sync's revalidation refreshes it.
  cacheLife({ stale: 300, revalidate: 30 * 86400, expire: 30 * 86400 });
  cacheTag(SEARCH_TAG);
  const p = schema.players;
  const sq = schema.squadPlayers;
  const named = ne(p.name, "");
  const [teams, seasons, rows] = await Promise.all([
    db
      .select({ id: schema.teams.id, slug: schema.teams.slug, name: schema.teams.name, logoUrl: schema.teams.logoUrl, seasonIds: schema.teams.seasonIds })
      .from(schema.teams),
    db.select().from(schema.seasons),
    db
      .select({ ...playerColumns, teamId: p.lastTeamId })
      .from(p)
      .where(named)
      // Until the sync applies the migration that adds `last_team_id`, only the squad's team is known.
      .catch(() =>
        db
          .select({ ...playerColumns, teamId: sq.teamId })
          .from(p)
          .leftJoin(sq, eq(sq.playerId, p.id))
          .where(named),
      ),
  ]);
  const current = seasons.sort((a, b) => a.name.localeCompare(b.name)).at(-1);
  teams.sort((a, b) => a.name.localeCompare(b.name, "es"));
  const position = new Map(teams.map((team, i) => [team.id, i]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    base: UPLOADS,
    teams: teams.map((team) => [team.slug, team.name, shortenUrl(team.logoUrl, UPLOADS), current && team.seasonIds.includes(current.id) ? 1 : 0]),
    players: [...byId.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((row) => [row.id, row.name, shortenUrl(row.photoUrl, UPLOADS), row.teamId === null ? -1 : (position.get(row.teamId) ?? -1)]),
  };
}

export async function getTeam(slug: string): Promise<Team | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  const row = await db.query.teams.findFirst({ where: eq(schema.teams.slug, slug) });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    seasonIds: row.seasonIds,
    photoUrl: row.photoUrl,
    video: row.youtubeUrl
      ? { url: row.youtubeUrl, title: row.youtubeTitle ?? "Vídeos", thumbnailUrl: row.youtubeThumbnailUrl }
      : null,
    flickrAlbumUrl: row.flickrAlbumUrl,
    leagueIds: row.leagueIds,
  };
}

const homeTeam = alias(schema.teams, "home_team");
const awayTeam = alias(schema.teams, "away_team");

/**
 * Matches with each team's current name. The match title in the API sometimes
 * names another team (e.g. "Roche Pharma" when Roche Femenino plays), so the
 * name comes from the linked team; the title's is kept as a fallback.
 */
function selectMatches() {
  return db
    .select({ match: schema.matches, homeTeamName: homeTeam.name, awayTeamName: awayTeam.name })
    .from(schema.matches)
    .leftJoin(homeTeam, eq(homeTeam.id, schema.matches.homeId))
    .leftJoin(awayTeam, eq(awayTeam.id, schema.matches.awayId));
}

type MatchRow = Awaited<ReturnType<typeof selectMatches>>[number];

function toMatch({ match: row, homeTeamName, awayTeamName }: MatchRow, scorers: Scorer[]): Match {
  return {
    id: row.id,
    date: row.date,
    round: row.round,
    homeId: row.homeId,
    awayId: row.awayId,
    homeName: homeTeamName ?? row.homeName,
    awayName: awayTeamName ?? row.awayName,
    homeGoals: row.homeGoals,
    awayGoals: row.awayGoals,
    played: row.played,
    seasonId: row.seasonId,
    leagueIds: row.leagueIds,
    groupId: row.groupId,
    competitionId: row.competitionId,
    venueId: row.venueId,
    scorers,
  };
}

function toMatchDetail(row: MatchRow, scorers: Scorer[]): MatchDetail {
  return {
    ...toMatch(row, scorers),
    photos: row.match.photos,
    video: row.match.videoId ? { id: row.match.videoId, title: row.match.videoTitle } : null,
  };
}

/** Players with something to show in each match (goals, assists, awards). */
async function scorersFor(matchIds: number[]): Promise<Map<number, Scorer[]>> {
  const result = new Map<number, Scorer[]>();
  if (matchIds.length === 0) return result;
  const mp = schema.matchPlayers;
  const rows = await db
    .select()
    .from(mp)
    .where(
      and(
        inArray(mp.matchId, matchIds),
        or(sql`${mp.goals} > 0`, sql`${mp.assists} > 0`, eq(mp.crack, true), eq(mp.dandy, true)),
      ),
    );
  for (const row of rows) {
    const list = result.get(row.matchId) ?? [];
    list.push({
      playerId: row.playerId,
      teamId: row.teamId,
      number: row.number,
      goals: row.goals,
      minutes: row.minutes,
      assists: row.assists,
      crack: row.crack,
      dandy: row.dandy,
    });
    result.set(row.matchId, list);
  }
  return result;
}

/** Every match of a season, with scorers. */
export async function getSeasonMatches(seasonId: number): Promise<Match[]> {
  "use cache";
  cacheLife("results");
  cacheTag(DATA_TAG);
  const rows = await selectMatches().where(eq(schema.matches.seasonId, seasonId)).orderBy(schema.matches.date);
  const scorers = await scorersFor(rows.map((r) => r.match.id));
  return rows.map((row) => toMatch(row, scorers.get(row.match.id) ?? []));
}

/** A group's matches with their photos. */
export async function getGroupMatches(groupId: number, seasonId: number): Promise<MatchDetail[]> {
  "use cache";
  cacheLife("results");
  cacheTag(DATA_TAG);
  const rows = await selectMatches()
    .where(and(eq(schema.matches.groupId, groupId), eq(schema.matches.seasonId, seasonId)))
    .orderBy(schema.matches.date);
  const scorers = await scorersFor(rows.map((r) => r.match.id));
  return rows.map((row) => toMatchDetail(row, scorers.get(row.match.id) ?? []));
}

/** A match with its photos, video and both teams' full match sheets. */
export async function getMatch(id: number): Promise<{ match: MatchDetail; lineups: LineupPlayer[] } | null> {
  "use cache";
  cacheLife("results");
  cacheTag(DATA_TAG);
  const [row] = await selectMatches().where(eq(schema.matches.id, id)).limit(1);
  if (!row) return null;
  const [scorers, rows] = await Promise.all([
    scorersFor([id]),
    db
      .select({ line: schema.matchPlayers, player: playerColumns })
      .from(schema.matchPlayers)
      .leftJoin(schema.players, eq(schema.players.id, schema.matchPlayers.playerId))
      .where(eq(schema.matchPlayers.matchId, id)),
  ]);
  const lineups = rows
    .map(({ line, player }) => ({
      playerId: line.playerId,
      teamId: line.teamId,
      name: player?.name ?? "",
      photoUrl: player?.photoUrl ?? null,
      number: line.number,
      position: line.position as Position | null,
      goals: line.goals,
      minutes: line.minutes,
      assists: line.assists,
      yellowCards: line.yellowCards,
      redCards: line.redCards,
      crack: line.crack,
      dandy: line.dandy,
      points: line.points,
    }))
    .sort((a, b) => Number(a.number ?? 999) - Number(b.number ?? 999));
  return { match: toMatchDetail(row, scorers.get(id) ?? []), lineups };
}

/** Every match of a team, from any season, by date. */
export async function getTeamMatches(teamId: number): Promise<Match[]> {
  "use cache";
  cacheLife("results");
  cacheTag(DATA_TAG);
  const m = schema.matches;
  const rows = await selectMatches()
    .where(or(eq(m.homeId, teamId), eq(m.awayId, teamId)))
    .orderBy(m.date);
  return rows.map((row) => toMatch(row, []));
}

/** Every meeting between two teams, from any season, most recent first. */
export async function getHeadToHead(teamA: number, teamB: number): Promise<Match[]> {
  "use cache";
  cacheLife("results");
  cacheTag(DATA_TAG);
  const m = schema.matches;
  const rows = await selectMatches()
    .where(or(and(eq(m.homeId, teamA), eq(m.awayId, teamB)), and(eq(m.homeId, teamB), eq(m.awayId, teamA))))
    .orderBy(desc(m.date));
  return rows.map((row) => toMatch(row, []));
}

export interface PlayerInfo {
  id: number;
  name: string;
  photoUrl: string | null;
}

export async function getPlayers(ids: number[]): Promise<Record<number, PlayerInfo>> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  if (ids.length === 0) return {};
  const rows = await db.select(playerColumns).from(schema.players).where(inArray(schema.players.id, ids));
  return Object.fromEntries(rows.map((p) => [p.id, p]));
}

export interface PlayerSquadEntry {
  teamId: number;
  number: string | null;
  position: string | null;
  mvpPoints: number;
  marketValue: number;
}

export interface PlayerLine {
  match: Match;
  line: Omit<LineupPlayer, "name" | "photoUrl">;
}

/**
 * A player's profile, match sheets and squads, from any season and team, by
 * date. null if they appear nowhere. Many players with a private profile have
 * no `players` row: their name is then empty.
 */
export async function getPlayerCareer(
  playerId: number,
): Promise<{ player: PlayerInfo; lines: PlayerLine[]; squads: PlayerSquadEntry[] } | null> {
  "use cache";
  cacheLife("results");
  cacheTag(DATA_TAG);
  const mp = schema.matchPlayers;
  const [rows, player, squads] = await Promise.all([
    db
      .select({ match: schema.matches, line: mp, homeTeamName: homeTeam.name, awayTeamName: awayTeam.name })
      .from(mp)
      .innerJoin(schema.matches, eq(schema.matches.id, mp.matchId))
      .leftJoin(homeTeam, eq(homeTeam.id, schema.matches.homeId))
      .leftJoin(awayTeam, eq(awayTeam.id, schema.matches.awayId))
      .where(eq(mp.playerId, playerId))
      .orderBy(schema.matches.date),
    db
      .select(playerColumns)
      .from(schema.players)
      .where(eq(schema.players.id, playerId))
      .then(([row]) => row),
    db
      .select({
        teamId: schema.squadPlayers.teamId,
        number: schema.squadPlayers.number,
        position: schema.squadPlayers.position,
        mvpPoints: schema.squadPlayers.mvpPoints,
        marketValue: schema.squadPlayers.marketValue,
      })
      .from(schema.squadPlayers)
      .where(eq(schema.squadPlayers.playerId, playerId)),
  ]);
  if (rows.length === 0 && !player && squads.length === 0) return null;
  return {
    player: { id: playerId, name: player?.name ?? "", photoUrl: player?.photoUrl ?? null },
    lines: rows.map(({ match, line, homeTeamName, awayTeamName }) => ({
      match: toMatch({ match, homeTeamName, awayTeamName }, []),
      line: {
        playerId: line.playerId,
        teamId: line.teamId,
        number: line.number,
        position: line.position as Position | null,
        goals: line.goals,
        minutes: line.minutes,
        assists: line.assists,
        yellowCards: line.yellowCards,
        redCards: line.redCards,
        crack: line.crack,
        dandy: line.dandy,
        points: line.points,
      },
    })),
    squads,
  };
}

/** Current season squad with the stats the league computes. */
export async function getSquad(teamId: number): Promise<SquadPlayer[]> {
  "use cache";
  cacheLife("results");
  cacheTag(DATA_TAG);
  const rows = await db
    .select({ squad: schema.squadPlayers, player: playerColumns })
    .from(schema.squadPlayers)
    .leftJoin(schema.players, eq(schema.players.id, schema.squadPlayers.playerId))
    .where(eq(schema.squadPlayers.teamId, teamId));
  return rows
    .map(({ squad, player }) => ({
      id: squad.playerId,
      name: player?.name ?? "",
      number: squad.number,
      position: squad.position as Position | null,
      photoUrl: player?.photoUrl ?? null,
      appearances: squad.appearances,
      goals: squad.goals,
      assists: squad.assists,
      mvpPoints: squad.mvpPoints,
      marketValue: squad.marketValue,
      crack: squad.crack,
      dandy: squad.dandy,
    }))
    .sort((a, b) => Number(a.number ?? 999) - Number(b.number ?? 999));
}

export interface TournamentWinner {
  id: number;
  title: string;
  competitionId: number | null;
  winnerId: number | null;
}

export async function getSeasonTournaments(seasonId: number): Promise<TournamentWinner[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  return db
    .select({
      id: schema.tournaments.id,
      title: schema.tournaments.title,
      competitionId: schema.tournaments.competitionId,
      winnerId: schema.tournaments.winnerId,
    })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.seasonId, seasonId));
}

export interface NewsItem {
  id: number;
  date: string;
  title: string;
  url: string;
}

export async function getLatestNews(count: number): Promise<NewsItem[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  return db.select().from(schema.news).orderBy(desc(schema.news.date)).limit(count);
}

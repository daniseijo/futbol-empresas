// Lecturas de la base de datos propia para las páginas. Nunca llaman a la API
// de la liga: eso lo hace la sincronización (src/sync). Las lecturas se cachean
// con "use cache" y la sincronización las invalida con la etiqueta "datos".

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema } from "@/db/client";
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

export const DATA_TAG = "datos";

export async function getSeasons(): Promise<Season[]> {
  "use cache";
  cacheLife("catalogo");
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
  cacheLife("catalogo");
  cacheTag(DATA_TAG);
  return db.select().from(schema.leagues);
}

/** Pares grupo–temporada con partidos (el grupo es el nodo más profundo de cada partido). */
export async function getGroupSeasons(): Promise<{ groupId: number; seasonId: number }[]> {
  "use cache";
  cacheLife("catalogo");
  cacheTag(DATA_TAG);
  const m = schema.matches;
  const rows = await db.selectDistinct({ groupId: m.groupId, seasonId: m.seasonId }).from(m);
  return rows.filter((row): row is { groupId: number; seasonId: number } => row.groupId !== null && row.seasonId !== null);
}

export async function getTeams(): Promise<TeamSummary[]> {
  "use cache";
  cacheLife("catalogo");
  cacheTag(DATA_TAG);
  const rows = await db
    .select({
      id: schema.teams.id,
      slug: schema.teams.slug,
      name: schema.teams.name,
      logoUrl: schema.teams.logoUrl,
      seasonIds: schema.teams.seasonIds,
    })
    .from(schema.teams);
  return rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getTeam(slug: string): Promise<Team | null> {
  "use cache";
  cacheLife("catalogo");
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
 * Partidos con el nombre actual de cada equipo. El título del partido en la
 * API a veces nombra a otro equipo (p. ej. «Roche Pharma» cuando juega Roche
 * Femenino), así que el nombre sale del equipo enlazado; el del título queda
 * como respaldo.
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

/** Jugadores con algo que contar en cada partido (goles, asistencias, premios). */
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

/** Todos los partidos de una temporada, con goleadores. */
export async function getSeasonMatches(seasonId: number): Promise<Match[]> {
  "use cache";
  cacheLife("resultados");
  cacheTag(DATA_TAG);
  const rows = await selectMatches().where(eq(schema.matches.seasonId, seasonId)).orderBy(schema.matches.date);
  const scorers = await scorersFor(rows.map((r) => r.match.id));
  return rows.map((row) => toMatch(row, scorers.get(row.match.id) ?? []));
}

/** Partidos de un grupo con sus fotos. */
export async function getGroupMatches(groupId: number, seasonId: number): Promise<MatchDetail[]> {
  "use cache";
  cacheLife("resultados");
  cacheTag(DATA_TAG);
  const rows = await selectMatches()
    .where(and(eq(schema.matches.groupId, groupId), eq(schema.matches.seasonId, seasonId)))
    .orderBy(schema.matches.date);
  const scorers = await scorersFor(rows.map((r) => r.match.id));
  return rows.map((row) => toMatchDetail(row, scorers.get(row.match.id) ?? []));
}

/** Un partido con sus fotos, su vídeo y el acta completa de los dos equipos. */
export async function getMatch(id: number): Promise<{ match: MatchDetail; lineups: LineupPlayer[] } | null> {
  "use cache";
  cacheLife("resultados");
  cacheTag(DATA_TAG);
  const [row] = await selectMatches().where(eq(schema.matches.id, id)).limit(1);
  if (!row) return null;
  const [scorers, rows] = await Promise.all([
    scorersFor([id]),
    db
      .select({ line: schema.matchPlayers, player: schema.players })
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

/** Todos los partidos de un equipo, de cualquier temporada, por fecha. */
export async function getTeamMatches(teamId: number): Promise<Match[]> {
  "use cache";
  cacheLife("resultados");
  cacheTag(DATA_TAG);
  const m = schema.matches;
  const rows = await selectMatches()
    .where(or(eq(m.homeId, teamId), eq(m.awayId, teamId)))
    .orderBy(m.date);
  return rows.map((row) => toMatch(row, []));
}

/** Todos los enfrentamientos entre dos equipos, de cualquier temporada, del más reciente al más antiguo. */
export async function getHeadToHead(teamA: number, teamB: number): Promise<Match[]> {
  "use cache";
  cacheLife("resultados");
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
  cacheLife("catalogo");
  cacheTag(DATA_TAG);
  if (ids.length === 0) return {};
  const rows = await db.select().from(schema.players).where(inArray(schema.players.id, ids));
  return Object.fromEntries(rows.map((p) => [p.id, { id: p.id, name: p.name, photoUrl: p.photoUrl }]));
}

/** Plantilla de la temporada en curso con las estadísticas que calcula la liga. */
export async function getSquad(teamId: number): Promise<SquadPlayer[]> {
  "use cache";
  cacheLife("resultados");
  cacheTag(DATA_TAG);
  const rows = await db
    .select({ squad: schema.squadPlayers, player: schema.players })
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
  cacheLife("catalogo");
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
  cacheLife("catalogo");
  cacheTag(DATA_TAG);
  return db.select().from(schema.news).orderBy(desc(schema.news.date)).limit(count);
}

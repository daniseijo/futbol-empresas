// Sincronización API → base de datos, progresiva y reanudable.
//
// Cada ejecución hace primero lo barato y urgente (catálogo y cambios desde la
// última vez) y después avanza en la carga inicial por orden de prioridad hasta
// agotar su presupuesto de tiempo. Guarda el avance tras cada unidad (una página
// de partidos, un equipo), así que si la API falla o se acaba el tiempo, la
// siguiente ejecución sigue donde se quedó. La web funciona con datos parciales.

import { and, desc, eq, getTableColumns, gte, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { siteConfig } from "@/config/site";
import { db, schema } from "@/db/client";
import { addDays, nowInMadrid } from "@/lib/dates";
import { SportsPressError } from "@/lib/sportspress/client";
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
/** Margen al pedir cambios desde la última sincronización, por si hubo cambios durante ella. */
const OVERLAP_MINUTES = 60;

type Log = (message: string) => void;

interface Context {
  log: Log;
  startedAt: string;
  deadline: number | null;
  seasons: Season[];
  current: Season;
  lookup: LeagueLookup;
  /** Cuántas filas se han escrito (para saber si hay que avisar a la web). */
  writes: number;
}

const hasTime = (ctx: Context) => ctx.deadline === null || Date.now() < ctx.deadline;

// --- Utilidades de base de datos -------------------------------------------------

/** INSERT ... ON CONFLICT DO UPDATE con todas las columnas que traen las filas. */
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
  for (const { match } of rows) if (match.seasonId === ctx.current.id) touched.add(match.homeId).add(match.awayId);
  ctx.writes += rows.length;
  return touched;
}

// --- Unidades de trabajo -----------------------------------------------------------

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
  await upsert(schema.players, players, [schema.players.id]);
  await db.update(schema.teams).set({ squadSyncedAt: ctx.startedAt }).where(eq(schema.teams.id, team.id));
  ctx.writes += 1;
}

// --- Tareas de la carga inicial (en orden de prioridad) ------------------------------

/** Todas las páginas de partidos de una temporada, con cursor de página. */
async function backfillSeasonMatches(ctx: Context, season: Season): Promise<boolean> {
  const key = `carga:partidos:${season.id}`;
  const state = await getState(key);
  if (state === "hecho") return true;
  let page = state ? Number(state) : 1;
  while (hasTime(ctx)) {
    let result;
    try {
      result = await fetchMatchesPage({ seasonId: season.id }, page, ctx.lookup);
    } catch (error) {
      // Página fuera de rango (se borraron partidos): la temporada está completa.
      if (error instanceof SportsPressError && error.status === 400) break;
      throw error;
    }
    await saveMatches(ctx, result.rows);
    ctx.log(`Partidos ${season.name}: página ${page}/${result.totalPages}`);
    if (page >= result.totalPages) break;
    page += 1;
    await setState(key, String(page));
  }
  if (!hasTime(ctx)) return false;
  await setState(key, "hecho");
  return true;
}

/** Procesa equipos uno a uno; la consulta ya excluye los hechos, así que es reanudable. */
async function forEachTeam(ctx: Context, label: string, teamIds: number[], work: (teamId: number) => Promise<void>): Promise<boolean> {
  for (const [index, teamId] of teamIds.entries()) {
    if (!hasTime(ctx)) return false;
    await work(teamId);
    if ((index + 1) % 10 === 0 || index + 1 === teamIds.length) ctx.log(`${label}: ${index + 1}/${teamIds.length}`);
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

/** El equipo principal y sus rivales de grupo: lo que se ve en la portada. */
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

/**
 * Nombres de jugadores que aparecen en alineaciones y aún no conocemos.
 * `withStats`: solo los que tienen algo que contar (goles, asistencias,
 * premios), que son los que salen en la portada. `/players` tarda ~10 s por
 * llamada, así que el resto va con menos prioridad.
 */
async function backfillPlayerNames(ctx: Context, { withStats }: { withStats: boolean }): Promise<boolean> {
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
    if (rows.length === 0) return true;
    const ids = rows.map((r) => r.id);
    const names = await fetchPlayerNames(ids);
    // Los que la API ya no devuelve (jugadores borrados) se guardan sin nombre
    // para no volver a pedirlos en cada ejecución.
    const missing = ids.filter((id) => !names.some((n) => n.id === id)).map((id) => ({ id, name: "" }));
    await upsert(schema.players, [...names, ...missing], [schema.players.id]);
    ctx.writes += names.length;
    ctx.log(`Jugadores: ${names.length} nombres nuevos`);
  }
  return false;
}

/** Cada partido sin vídeo se vuelve a mirar como mucho cada 6 horas. */
const VIDEO_RECHECK_MINUTES = 6 * 60;
/** El resumen se publica uno o dos días después; pasadas dos semanas no se busca más a menudo. */
const VIDEO_RECENT_DAYS = 14;

/**
 * Busca el resumen en vídeo en la página web de cada partido (la API no lo da).
 * `current`: partidos jugados de la temporada actual sin vídeo. Los que nunca
 * se han mirado, siempre; los de las dos últimas semanas, otra vez cada 6 horas
 * (el vídeo se publica uno o dos días después del partido).
 * Si no: cualquier partido jugado que nunca se haya mirado (el histórico).
 */
async function backfillMatchVideos(ctx: Context, { current }: { current: boolean }): Promise<boolean> {
  const m = schema.matches;
  const where = current
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
  let found = 0;
  let checked = 0;
  while (hasTime(ctx)) {
    const rows = await db.select({ id: m.id }).from(m).where(where).orderBy(desc(m.date)).limit(20);
    if (rows.length === 0) break;
    for (const { id } of rows) {
      if (!hasTime(ctx)) break;
      const video = await fetchMatchVideo(id).catch((error) => {
        if (error instanceof SportsPressError) return null; // página borrada o no publicada
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
    }
    ctx.log(`Vídeos${current ? "" : " (histórico)"}: ${found} encontrados en ${checked} partidos`);
  }
  return hasTime(ctx);
}

// --- Orquestación ------------------------------------------------------------------

export interface SyncResult {
  writes: number;
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
  await migrate(db, { migrationsFolder: "drizzle" });
  if (reset) {
    await db.delete(schema.syncState);
    await db.update(schema.teams).set({ detailSyncedAt: null, squadSyncedAt: null });
    log("Estado de la carga reiniciado: se volverá a descargar todo");
  }

  // Catálogo: temporadas y árbol de competiciones (3 llamadas, siempre).
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
  };
  log(`Temporada actual ${ctx.current.name}${budgetSeconds ? ` · presupuesto ${budgetSeconds} s` : ""}`);

  // 0. Partidos pedidos expresamente (pnpm sync -- --partidos=1,2,3).
  for (let i = 0; i < matchIds.length; i += 50) {
    const result = await fetchMatchesPage({ ids: matchIds.slice(i, i + 50) }, 1, ctx.lookup);
    await saveMatches(ctx, result.rows);
    log(`Partidos vueltos a descargar: ${result.rows.map((r) => r.match.id).join(", ")}`);
  }

  // 1. Cambios desde la última ejecución (barato: solo lo modificado).
  const since = await getState("cambios");
  if (since) {
    const after = minusMinutes(since, OVERLAP_MINUTES);
    const teams = await fetchTeams(after);
    await upsert(schema.teams, teams, [schema.teams.id]);
    const touched = new Set(teams.map((t) => t.id));
    for (let page = 1, total = 1; page <= total; page += 1) {
      const result = await fetchMatchesPage({ modifiedAfter: after }, page, ctx.lookup);
      total = result.totalPages;
      for (const id of await saveMatches(ctx, result.rows)) touched.add(id);
    }
    log(`Cambios desde ${since}: ${teams.length} equipos y ${touched.size} equipos con partidos`);
    for (const teamId of teams.map((t) => t.id)) await syncTeamDetail(ctx, teamId);
    for (const teamId of touched) await syncSquad(ctx, teamId);
  } else if (!(await getState("carga:equipos"))) {
    const teams = await fetchTeams();
    await upsert(schema.teams, teams, [schema.teams.id]);
    await setState("carga:equipos", "hecho");
    log(`Equipos: ${teams.length}`);
  }
  await setState("cambios", ctx.startedAt);
  await upsert(schema.tournaments, await fetchTournaments(ctx.current.id), [schema.tournaments.id]);
  await upsert(schema.news, await fetchNews(10), [schema.news.id]);

  // 2. Carga inicial por prioridad, hasta agotar el presupuesto.
  const tasks: [string, () => Promise<boolean>][] = [
    [`Partidos ${ctx.current.name}`, () => backfillSeasonMatches(ctx, ctx.current)],
    [
      "Equipo principal y su grupo",
      async () => {
        const ids = await focusTeamIds(ctx);
        const details = await forEachTeam(ctx, "Detalle (grupo)", await pendingTeams(ctx, schema.teams.detailSyncedAt, ids), (id) => syncTeamDetail(ctx, id));
        const squads = await forEachTeam(ctx, "Plantillas (grupo)", await pendingTeams(ctx, schema.teams.squadSyncedAt, ids), (id) => syncSquad(ctx, id));
        return details && squads;
      },
    ],
    ["Nombres de goleadores", () => backfillPlayerNames(ctx, { withStats: true })],
    ["Vídeos de la temporada actual", () => backfillMatchVideos(ctx, { current: true })],
    [
      "Detalle de equipos",
      async () =>
        forEachTeam(ctx, "Detalle de equipos", await pendingTeams(ctx, schema.teams.detailSyncedAt), (id) => syncTeamDetail(ctx, id)),
    ],
    ["Plantillas", async () => forEachTeam(ctx, "Plantillas", await pendingTeams(ctx, schema.teams.squadSyncedAt), (id) => syncSquad(ctx, id))],
    ["Nombres de las alineaciones", () => backfillPlayerNames(ctx, { withStats: false })],
    [
      "Campeones de temporadas pasadas",
      async () => {
        if ((await getState("carga:torneos")) === "hecho") return true;
        for (const season of ctx.seasons) await upsert(schema.tournaments, await fetchTournaments(season.id), [schema.tournaments.id]);
        await setState("carga:torneos", "hecho");
        return true;
      },
    ],
    ...[...ctx.seasons]
      .reverse()
      .slice(1)
      .map((season): [string, () => Promise<boolean>] => [`Partidos ${season.name}`, () => backfillSeasonMatches(ctx, season)]),
    ["Nombres de las alineaciones (histórico)", () => backfillPlayerNames(ctx, { withStats: false })],
    ["Vídeos (histórico)", () => backfillMatchVideos(ctx, { current: false })],
  ];

  const pending: string[] = [];
  for (const [name, task] of tasks) {
    if (!hasTime(ctx) || !(await task())) pending.push(name);
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  log(pending.length ? `Pausa a los ${seconds} s. Pendiente: ${pending.join(", ")}` : `Todo al día en ${seconds} s`);
  return { writes: ctx.writes, pending, seconds };
}

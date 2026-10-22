// Descarga de la API de SportsPress y normalización a filas de la base de datos.
// Solo lo usa la sincronización (nunca el render), así que puede ser lenta.

import { toLocalStamp } from "@/lib/dates";
import { getAll, getHtml, getPage, SportsPressError, type Page } from "@/lib/sportspress/client";
import {
  cleanTeamName,
  decodeHtml,
  extractFlickrAlbum,
  extractFlickrPhotos,
  extractHeaderMediaId,
  extractYoutubeUrl,
  isFlag,
  isPlaceholderTeamPhoto,
  parseEventTitle,
  parseGoals,
  toNumber,
} from "@/lib/sportspress/parse";
import type {
  RawEvent,
  RawList,
  RawMedia,
  RawPerformanceRow,
  RawPlayer,
  RawPost,
  RawTeam,
  RawTerm,
  RawTournament,
} from "@/lib/sportspress/raw";
import type { schema } from "@/db/client";

type Row<T extends { $inferInsert: unknown }> = T["$inferInsert"];
export type MatchRow = Row<typeof schema.matches> & { id: number };
export type MatchPlayerRow = Row<typeof schema.matchPlayers>;
export type TeamRow = Row<typeof schema.teams> & { id: number };
export type SquadRow = Row<typeof schema.squadPlayers>;
export type PlayerRow = Row<typeof schema.players>;

const SP = "/sportspress/v2";

// --- Catálogo -----------------------------------------------------------------

export async function fetchSeasons() {
  const terms = await getAll<RawTerm>(`${SP}/seasons`, { _fields: "id,name" });
  // Además de "22/23", "23/24"... hay marcadores como "Actual" que ignoramos.
  return terms.filter((t) => /^\d{2}\/\d{2}$/.test(t.name)).map((t) => ({ id: t.id, name: t.name }));
}

export async function fetchLeagues() {
  const terms = await getAll<RawTerm>(`${SP}/leagues`, { _fields: "id,name,slug,parent" });
  return terms.map((t) => ({ id: t.id, name: decodeHtml(t.name), slug: t.slug, parentId: t.parent === 0 ? null : t.parent }));
}

function pickSize(media: RawMedia, preferred: string[]): string {
  const sizes = media.media_details?.sizes ?? {};
  for (const name of preferred) if (sizes[name]) return sizes[name].source_url;
  return media.source_url;
}

const SIZES = { logo: ["sportspress-fit-icon", "thumbnail"], photo: ["medium", "medium_large"], full: ["large", "full"] };

export async function fetchMediaUrls(ids: number[], kind: keyof typeof SIZES): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id) => id > 0))];
  const result = new Map<number, string>();
  for (let i = 0; i < unique.length; i += 100) {
    const { items } = await getPage<RawMedia>("/wp/v2/media", {
      include: unique.slice(i, i + 100).join(","),
      per_page: 100,
      _fields: "id,source_url,media_details",
    });
    for (const media of items) result.set(media.id, pickSize(media, SIZES[kind]));
  }
  return result;
}

/**
 * Equipos con su escudo. `modifiedAfter` limita a los modificados desde la
 * última sincronización (hora local de Madrid). Sin `content`: renderizarlo
 * ejecuta los shortcodes de la página del equipo y con 25 equipos ya da 504.
 */
export async function fetchTeams(modifiedAfter?: string): Promise<TeamRow[]> {
  const raw = await getAll<RawTeam & { modified: string }>(`${SP}/teams`, {
    modified_after: modifiedAfter,
    _fields: "id,slug,title,featured_media,leagues,seasons,lists,modified",
  });
  const logos = await fetchMediaUrls(
    raw.map((t) => t.featured_media),
    "logo",
  );
  return raw.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: decodeHtml(t.title.rendered),
    logoUrl: logos.get(t.featured_media) ?? null,
    seasonIds: t.seasons,
    leagueIds: t.leagues,
    listIds: t.lists ?? [],
    modified: t.modified,
  }));
}

/** Foto de equipo, vídeo y álbum, sacados del contenido de su página (~2,5 s por equipo). */
export async function fetchTeamDetail(teamId: number) {
  const { items } = await getPage<RawTeam>(`${SP}/teams`, { include: teamId, _fields: "id,content" });
  const html = items[0]?.content?.rendered;
  const headerId = extractHeaderMediaId(html);
  const photo = headerId ? (await fetchMediaUrls([headerId], "full")).get(headerId) : undefined;
  return {
    photoUrl: photo && !isPlaceholderTeamPhoto(photo) ? photo : null,
    youtubeUrl: extractYoutubeUrl(html),
    flickrAlbumUrl: extractFlickrAlbum(html),
  };
}

/**
 * Resumen en vídeo de un partido. SportsPress guarda el vídeo como metadato
 * del partido y la API no lo expone, pero la página web del partido lo
 * incrusta en su sección «Video» (sp-event-video).
 */
export async function fetchMatchVideo(matchId: number): Promise<{ id: string; title: string | null } | null> {
  const html = await getHtml(`/?post_type=sp_event&p=${matchId}`);
  const start = html.indexOf("sp-event-video");
  if (start === -1) return null;
  const section = html.slice(start, start + 4000);
  // El iframe va bloqueado por el aviso de cookies: la URL real está escapada en data-wpca-marked-data.
  const id = section.match(/youtube(?:-nocookie)?\.com\\?\/embed\\?\/([\w-]{11})/)?.[1];
  if (!id) return null;
  const title = section.match(/<iframe[^>]*\stitle="([^"]*)"/)?.[1];
  return { id, title: title ? decodeHtml(title) : null };
}

/** Título y miniatura de una lista o vídeo de YouTube (oEmbed público). */
export async function fetchYoutubeInfo(url: string): Promise<{ title: string; thumbnailUrl: string | null } | null> {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { title?: string; thumbnail_url?: string };
  return { title: data.title ?? "Vídeos", thumbnailUrl: data.thumbnail_url ?? null };
}

// --- Partidos -----------------------------------------------------------------

const POSITION_IDS: Record<number, string> = { 100: "POR", 99: "DEF", 98: "MED", 97: "DEL" };

function mapLineups(matchId: number, performance: RawEvent["performance"]): MatchPlayerRow[] {
  const rows: MatchPlayerRow[] = [];
  for (const [teamKey, players] of Object.entries(performance ?? {})) {
    if (teamKey === "0" || Array.isArray(players)) continue;
    for (const [playerKey, row] of Object.entries(players as Record<string, RawPerformanceRow>)) {
      const playerId = Number(playerKey);
      if (!playerId || typeof row !== "object" || row === null) continue;
      const goals = parseGoals(row.goals);
      // Normalmente es una lista de ids, pero algunos partidos traen un texto o un objeto.
      const rawPosition: unknown = row.position;
      const positionIds = Array.isArray(rawPosition)
        ? rawPosition
        : rawPosition && typeof rawPosition === "object"
          ? Object.values(rawPosition)
          : [rawPosition];
      const position = positionIds.map((id) => POSITION_IDS[Number(id)]).find(Boolean) ?? null;
      rows.push({
        matchId,
        playerId,
        teamId: Number(teamKey),
        number: row.number ? String(row.number) : null,
        position,
        goals: goals.count,
        minutes: goals.minutes,
        assists: toNumber(row.asistencia),
        yellowCards: toNumber(row.yellowcards),
        redCards: toNumber(row.redcards),
        crack: isFlag(row.crack),
        dandy: isFlag(row.dandy),
        points: toNumber(row.puntuacion),
      });
    }
  }
  return rows;
}

export interface LeagueLookup {
  deepest(ids: number[]): number | null;
  root(id: number): number | null;
}

function mapEvent(raw: RawEvent & { modified?: string }, leagues: LeagueLookup) {
  if (raw.teams.length !== 2) return null;
  const { round, home, away } = parseEventTitle(raw.title.rendered);
  const [homeResult, awayResult] = raw.main_results ?? [];
  // Un partido con resultado cuenta como jugado aunque la API diga "future".
  const played = homeResult !== undefined && awayResult !== undefined && homeResult !== "" && awayResult !== "";
  const groupId = leagues.deepest(raw.leagues);
  const match: MatchRow = {
    id: raw.id,
    date: toLocalStamp(raw.date),
    round,
    seasonId: raw.seasons[0] ?? null,
    homeId: raw.teams[0],
    awayId: raw.teams[1],
    homeName: cleanTeamName(home),
    awayName: cleanTeamName(away),
    homeGoals: played ? toNumber(homeResult) : null,
    awayGoals: played ? toNumber(awayResult) : null,
    played,
    leagueIds: raw.leagues,
    groupId,
    competitionId: groupId ? leagues.root(groupId) : null,
    venueId: raw.venues[0] ?? null,
    photos: extractFlickrPhotos(raw.content?.rendered),
    modified: raw.modified ?? null,
  };
  return { match, lineups: mapLineups(raw.id, raw.performance) };
}

const EVENT_FIELDS = "id,date,modified,status,title,leagues,seasons,venues,teams,main_results,performance,content";

/** Tamaño de los grupos en que se pide el `content` cuando una página falla. */
const CONTENT_CHUNK = 10;

/**
 * El `content` de varios partidos. Si WordPress no consigue generar el de
 * alguno (500 permanente), parte el grupo por la mitad hasta aislarlo: ese se
 * queda sin `content` (sin fotos) y el resto lo conserva.
 */
async function fetchEventsContent(ids: number[]): Promise<Map<number, RawEvent["content"]>> {
  const contents = new Map<number, RawEvent["content"]>();
  if (ids.length === 0) return contents;
  try {
    const { items } = await getPage<Pick<RawEvent, "id" | "content">>(
      `${SP}/events`,
      { include: ids.join(","), per_page: ids.length, _fields: "id,content" },
      { failFastOn500: true },
    );
    for (const item of items) contents.set(item.id, item.content);
  } catch (error) {
    if (!(error instanceof SportsPressError) || error.status !== 500) throw error;
    if (ids.length === 1) return contents;
    const half = Math.ceil(ids.length / 2);
    for (const part of [ids.slice(0, half), ids.slice(half)]) {
      for (const [id, content] of await fetchEventsContent(part)) contents.set(id, content);
    }
  }
  return contents;
}

/**
 * Una página de partidos de una temporada, modificados desde una fecha o
 * concretos (por id).
 * Ordenados por id: los partidos nuevos van al final, así que un cursor de
 * página sigue siendo válido entre ejecuciones.
 */
export async function fetchMatchesPage(
  filter: { seasonId?: number; modifiedAfter?: string; ids?: number[] },
  page: number,
  leagues: LeagueLookup,
): Promise<{ rows: { match: MatchRow; lineups: MatchPlayerRow[] }[]; totalPages: number }> {
  const params = {
    seasons: filter.seasonId,
    modified_after: filter.modifiedAfter,
    include: filter.ids?.join(","),
    orderby: "id",
    order: "asc",
    per_page: 50, // con `content` y `performance`, más grandes provocan un 504
    page,
  };
  let result: Page<RawEvent & { modified: string }>;
  try {
    result = await getPage<RawEvent & { modified: string }>(`${SP}/events`, { ...params, _fields: EVENT_FIELDS }, { failFastOn500: true });
  } catch (error) {
    // Algún partido rompe WordPress al generar su `content` (500 persistente,
    // p. ej. el 86748; en la 23/24, casi una página de cada dos): se pide la
    // página sin él y el contenido aparte, en grupos.
    if (!(error instanceof SportsPressError) || error.status !== 500) throw error;
    result = await getPage<RawEvent & { modified: string }>(`${SP}/events`, {
      ...params,
      _fields: EVENT_FIELDS.replace(",content", ""),
    });
    const ids = result.items.map((event) => event.id);
    const contents = new Map<number, RawEvent["content"]>();
    for (let i = 0; i < ids.length; i += CONTENT_CHUNK) {
      for (const [id, content] of await fetchEventsContent(ids.slice(i, i + CONTENT_CHUNK))) contents.set(id, content);
    }
    for (const event of result.items) event.content = contents.get(event.id);
  }
  return {
    rows: result.items.map((event) => mapEvent(event, leagues)).filter((m) => m !== null),
    totalPages: result.totalPages,
  };
}

// --- Jugadores y plantillas -----------------------------------------------------

/** Nombres de jugadores por id. /players es muy lento (~10 s por llamada). */
export async function fetchPlayerNames(ids: number[]): Promise<PlayerRow[]> {
  const rows: PlayerRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { items } = await getPage<RawPlayer>(`${SP}/players`, {
      include: ids.slice(i, i + 100).join(","),
      per_page: 100,
      _fields: "id,slug,title",
    });
    rows.push(...items.map((p) => ({ id: p.id, slug: p.slug, name: decodeHtml(p.title.rendered) })));
  }
  return rows;
}

/**
 * Fotos reales de jugadores: imágenes adjuntas a cada jugador. El avatar
 * genérico de la liga no está adjunto a ninguno, así que no aparece.
 */
export async function fetchPlayerPhotos(playerIds: number[]): Promise<Map<number, string>> {
  const photos = new Map<number, string>();
  for (let i = 0; i < playerIds.length; i += 100) {
    const { items } = await getPage<RawMedia & { post: number }>("/wp/v2/media", {
      parent: playerIds.slice(i, i + 100).join(","),
      per_page: 100,
      orderby: "id",
      order: "asc",
      _fields: "id,post,source_url,media_details",
    });
    for (const media of items) if (!photos.has(media.post)) photos.set(media.post, pickSize(media, SIZES.photo));
  }
  return photos;
}

const POSITION_LISTS: [RegExp, string][] = [
  [/porter/i, "POR"],
  [/defens/i, "DEF"],
  [/medio/i, "MED"],
  [/delanter/i, "DEL"],
];

/**
 * Plantilla de un equipo desde sus listas: la lista «Plantilla» da las
 * estadísticas (MVP y valor los calcula la liga) y las listas por posición
 * dan la posición de cada jugador.
 */
export async function fetchSquad(teamId: number, listIds: number[]): Promise<{ squad: SquadRow[]; players: PlayerRow[] }> {
  if (listIds.length === 0) return { squad: [], players: [] };
  const { items: lists } = await getPage<RawList>(`${SP}/lists`, {
    include: listIds.join(","),
    per_page: 100,
    _fields: "id,title,data",
  });
  const title = (l: RawList) => decodeHtml(l.title.rendered);
  const main = lists.find((l) => /plantilla/i.test(title(l))) ?? lists.find((l) => /estad/i.test(title(l)));
  if (!main) return { squad: [], players: [] };

  const positions = new Map<number, string>();
  for (const list of lists) {
    const position = POSITION_LISTS.find(([pattern]) => pattern.test(title(list)))?.[1];
    if (!position) continue;
    for (const key of Object.keys(list.data)) if (key !== "0") positions.set(Number(key), position);
  }

  const rows = Object.entries(main.data).filter(([key]) => key !== "0");
  const photos = await fetchPlayerPhotos(rows.map(([key]) => Number(key)));
  const squad: SquadRow[] = [];
  const players: PlayerRow[] = [];
  for (const [key, stats] of rows) {
    const playerId = Number(key);
    const number = stats.number;
    squad.push({
      teamId,
      playerId,
      number: number === undefined || number === null || number === "" || number === "-" ? null : String(number),
      position: positions.get(playerId) ?? null,
      appearances: toNumber(stats.appearances),
      goals: toNumber(stats.goals),
      assists: toNumber(stats.asistencia),
      mvpPoints: toNumber(stats.mvp),
      marketValue: toNumber(stats.valor),
      crack: toNumber(stats.crack),
      dandy: toNumber(stats.dandy),
    });
    players.push({ id: playerId, name: decodeHtml(String(stats.name ?? "")), photoUrl: photos.get(playerId) ?? null });
  }
  return { squad, players };
}

// --- Otros --------------------------------------------------------------------

export async function fetchTournaments(seasonId: number) {
  const raw = await getAll<RawTournament>(`${SP}/tournaments`, { seasons: seasonId, _fields: "id,title,leagues,seasons,winner" });
  return raw.map((t) => ({
    id: t.id,
    title: decodeHtml(t.title.rendered),
    seasonId,
    competitionId: t.leagues[0] ?? null,
    winnerId: t.winner ? Number(t.winner) : null,
  }));
}

export async function fetchNews(count: number) {
  const { items } = await getPage<RawPost>("/wp/v2/posts", { per_page: count, _fields: "id,date,link,title" });
  return items.map((p) => ({ id: p.id, date: toLocalStamp(p.date), title: decodeHtml(p.title.rendered), url: p.link }));
}

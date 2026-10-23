// Downloads from the SportsPress API and normalizes them into database rows.
// Only the sync uses it (never rendering), so it is allowed to be slow.

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
  parseMatchVideo,
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

// --- Catalog -------------------------------------------------------------------

export async function fetchSeasons() {
  const terms = await getAll<RawTerm>(`${SP}/seasons`, { _fields: "id,name" });
  // Besides "22/23", "23/24"... there are markers such as "Actual" that we skip.
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
 * Teams with their crest. `modifiedAfter` limits them to those modified since
 * the last sync (Madrid local time). No `content`: rendering it runs the team
 * page's shortcodes, and 25 teams are already enough for a 504.
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

/** Team photo, video and album, taken from its page content (~2.5 s per team). */
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
 * A match's video highlights. SportsPress stores the video as match metadata
 * and the API does not expose it, but the match web page embeds it in its
 * "Video" section (sp-event-video).
 */
export async function fetchMatchVideo(matchId: number): Promise<{ id: string; title: string | null } | null> {
  return parseMatchVideo(await getHtml(`/?post_type=sp_event&p=${matchId}`));
}

/** Title and thumbnail of a YouTube playlist or video (public oEmbed). */
export async function fetchYoutubeInfo(url: string): Promise<{ title: string; thumbnailUrl: string | null } | null> {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { title?: string; thumbnail_url?: string };
  return { title: data.title ?? "Vídeos", thumbnailUrl: data.thumbnail_url ?? null };
}

// --- Matches -------------------------------------------------------------------

const POSITION_IDS: Record<number, string> = { 100: "POR", 99: "DEF", 98: "MED", 97: "DEL" };

function mapLineups(matchId: number, performance: RawEvent["performance"]): MatchPlayerRow[] {
  const rows: MatchPlayerRow[] = [];
  for (const [teamKey, players] of Object.entries(performance ?? {})) {
    if (teamKey === "0" || Array.isArray(players)) continue;
    for (const [playerKey, row] of Object.entries(players as Record<string, RawPerformanceRow>)) {
      const playerId = Number(playerKey);
      if (!playerId || typeof row !== "object" || row === null) continue;
      const goals = parseGoals(row.goals);
      // Usually a list of ids, but some matches carry a string or an object.
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

export function mapEvent(raw: RawEvent & { modified?: string }, leagues: LeagueLookup) {
  if (raw.teams.length !== 2) return null;
  const { round, home, away } = parseEventTitle(raw.title.rendered);
  const [homeResult, awayResult] = raw.main_results ?? [];
  // A match with a score counts as played even if the API says "future".
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

/** Chunk size used to request `content` when a page fails. */
const CONTENT_CHUNK = 10;

/**
 * The `content` of several matches. If WordPress cannot render one of them
 * (persistent 500), the group is split in half until that one is isolated: it
 * is left without `content` (no photos) and the rest keep theirs.
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
 * One page of matches: from a season, modified since a date, or specific ids.
 * Sorted by id: new matches go last, so a page cursor stays valid between runs.
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
    per_page: 50, // with `content` and `performance`, larger pages cause a 504
    page,
  };
  let result: Page<RawEvent & { modified: string }>;
  try {
    result = await getPage<RawEvent & { modified: string }>(`${SP}/events`, { ...params, _fields: EVENT_FIELDS }, { failFastOn500: true });
  } catch (error) {
    // Some matches break WordPress when rendering their `content` (persistent
    // 500, e.g. 86748; in 23/24, almost every other page): fetch the page
    // without it and the content separately, in chunks.
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

// --- Players and squads ---------------------------------------------------------

/** Player names by id. /players is very slow (~10 s per call). */
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
 * Real player photos: images attached to each player. The league's generic
 * avatar is not attached to anyone, so it never shows up.
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
 * A team's squad from its lists: the "Plantilla" list gives the stats (the
 * league computes MVP and market value) and the per-position lists give each
 * player's position.
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

// --- Other ----------------------------------------------------------------------

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

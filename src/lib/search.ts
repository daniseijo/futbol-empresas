// The header search: one index of teams and players that the browser downloads
// the first time the search is used (/api/busqueda), and the matching over it.
// Searching in the browser means a search never reads the database: a scan of
// `players` per keystroke would eat Turso's monthly read quota.

/** What /api/busqueda returns: compact, to keep ~7,000 players small. */
export interface SearchIndexPayload {
  /** Prefix removed from logo and photo URLs that start with it. */
  base: string;
  /** [slug, name, logo URL or path, 1 if it plays this season] */
  teams: [string, string, string | null, 0 | 1][];
  /** [id, name, photo URL or path, position of their team in `teams` or -1]; only players with a name. */
  players: [number, string, string | null, number][];
}

export interface TeamResult {
  slug: string;
  name: string;
  logoUrl: string | null;
  active: boolean;
}

export interface PlayerResult {
  id: number;
  name: string;
  photoUrl: string | null;
  team: string | null;
  /** Their team plays this season. */
  active: boolean;
}

interface Entry<T> {
  item: T;
  /** Normalised name with a leading space, so " word" finds a word start. */
  key: string;
}

export interface SearchIndex {
  teams: Entry<TeamResult>[];
  players: Entry<PlayerResult>[];
}

export const MAX_TEAMS = 5;
export const MAX_PLAYERS = 6;
/** Below this, a query matches too many players to be useful. */
export const MIN_PLAYER_QUERY = 2;

/** Lower case, no accents, and anything that is not a letter or digit as one space. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

export function shortenUrl(url: string | null, base: string): string | null {
  return url?.startsWith(base) ? url.slice(base.length) : url;
}

function expandUrl(url: string | null, base: string): string | null {
  return url && !url.startsWith("http") ? base + url : url;
}

export function decodeIndex(payload: SearchIndexPayload): SearchIndex {
  const teams = payload.teams.map(([slug, name, logo, active]) => ({
    item: { slug, name, logoUrl: expandUrl(logo, payload.base), active: active === 1 },
    key: ` ${normalize(name)}`,
  }));
  const players = payload.players.map(([id, name, photo, teamIndex]) => {
    const team = teams[teamIndex]?.item;
    return {
      item: { id, name, photoUrl: expandUrl(photo, payload.base), team: team?.name ?? null, active: team?.active ?? false },
      key: ` ${normalize(name)}`,
    };
  });
  return { teams, players };
}

/** 0: the name starts with the query; 1: a word does; 2: it is somewhere inside; null: no match. */
function rank(key: string, query: string, { inside }: { inside: boolean }): number | null {
  if (key.startsWith(` ${query}`)) return 0;
  if (key.includes(` ${query}`)) return 1;
  if (inside && key.includes(query)) return 2;
  return null;
}

function best<T extends { active: boolean }>(entries: Entry<T>[], query: string, max: number, inside: boolean): T[] {
  const hits: { item: T; rank: number; order: number }[] = [];
  entries.forEach(({ item, key }, order) => {
    const r = rank(key, query, { inside });
    if (r !== null) hits.push({ item, rank: r, order });
  });
  // The index comes sorted by name: ties keep that order.
  hits.sort((a, b) => a.rank - b.rank || Number(b.item.active) - Number(a.item.active) || a.order - b.order);
  return hits.slice(0, max).map((hit) => hit.item);
}

/**
 * Teams match anywhere in the name ("telefonica" finds "Grupo Telefónica");
 * players only at the start of a word ("lertx" finds "Telmo Lertxundi"), or
 * a short query would match half the league. Whole-name prefixes first, then
 * teams and players that play this season.
 */
export function search(index: SearchIndex, rawQuery: string): { teams: TeamResult[]; players: PlayerResult[] } {
  const query = normalize(rawQuery);
  if (!query) return { teams: [], players: [] };
  return {
    teams: best(index.teams, query, MAX_TEAMS, true),
    players: query.length >= MIN_PLAYER_QUERY ? best(index.players, query, MAX_PLAYERS, false) : [],
  };
}

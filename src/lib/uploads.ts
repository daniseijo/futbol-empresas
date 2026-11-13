// Team crests and player photos are served from the site (/escudos/…, /fotos/…) rather than from the
// league's WordPress, which is slow and whose Cloudflare blocks some networks. The sync copies them into
// the database (the `crests` and `player_photos` tables), keyed by their league URL; the path after the
// folder is that URL's path under the league's uploads.

/** Where the league keeps its crests and photos. */
export const LEAGUE_UPLOADS = "https://www.futbolempresas.es/wp-content/uploads/";

function siteCopy(folder: string, url: string | null | undefined) {
  return url?.startsWith(LEAGUE_UPLOADS) ? `/${folder}/${url.slice(LEAGUE_UPLOADS.length)}` : url;
}

/** The site's copy of a league crest URL; any other URL is left as it is. */
export function crestSrc<T extends string | null | undefined>(url: T): T {
  return siteCopy("escudos", url) as T;
}

/** The site's copy of a league player photo URL; any other URL is left as it is. */
export function photoSrc<T extends string | null | undefined>(url: T): T {
  return siteCopy("fotos", url) as T;
}

/** The league URL behind a /escudos/ or /fotos/ path, or null for a path that cannot be one ("..", odd characters). */
export function leagueUploadUrl(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((s) => !/^[\w.-]+$/.test(s) || /^\.+$/.test(s))) return null;
  return LEAGUE_UPLOADS + segments.join("/");
}

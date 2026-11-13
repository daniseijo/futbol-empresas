// Team crests are served from the site (/escudos/…) rather than from the league's WordPress, which is slow
// and whose Cloudflare blocks some networks. The sync copies them into the `crests` table, keyed by their
// league URL; the path under /escudos/ is that URL's path under the uploads folder.

/** Where the league keeps every team crest. */
export const LEAGUE_UPLOADS = "https://www.futbolempresas.es/wp-content/uploads/";

/** The site's copy of a league crest URL; any other URL is left as it is. */
export function crestSrc(url: string): string;
export function crestSrc(url: string | null | undefined): string | null | undefined;
export function crestSrc(url: string | null | undefined) {
  return url?.startsWith(LEAGUE_UPLOADS) ? `/escudos/${url.slice(LEAGUE_UPLOADS.length)}` : url;
}

/** The league URL behind an /escudos/ path, or null for a path that cannot be one ("..", odd characters). */
export function leagueCrestUrl(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((s) => !/^[\w.-]+$/.test(s) || /^\.+$/.test(s))) return null;
  return LEAGUE_UPLOADS + segments.join("/");
}

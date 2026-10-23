const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** WordPress returns titles with entities (&#8211;, &amp;...). */
export function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .trim();
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

const ROUND_PREFIX = /^J(\d+)\s*[–-]\s*/i;

/** "J3 – EY Abogados vs Embat" → round 3, home and away. */
export function parseEventTitle(raw: string): { round: number | null; home: string; away: string } {
  let title = decodeHtml(raw);
  const roundMatch = title.match(ROUND_PREFIX);
  const round = roundMatch ? Number(roundMatch[1]) : null;
  title = title.replace(ROUND_PREFIX, "");
  const [home = "", away = ""] = title.split(/\s+vs\s+/i);
  return { round, home: cleanTeamName(home), away: cleanTeamName(away) };
}

/** Some titles have the round stuck to the name ("J1- Simon Kucher"). */
export function cleanTeamName(name: string): string {
  return name.replace(ROUND_PREFIX, "").trim();
}

/** Match sheet goals: "2 (42', 44')" → { count: 2, minutes: [42, 44] }. */
export function parseGoals(value: unknown): { count: number; minutes: number[] } {
  if (typeof value === "number") return { count: value, minutes: [] };
  if (typeof value !== "string" || value.trim() === "") return { count: 0, minutes: [] };
  const count = parseInt(value, 10) || 0;
  const minutes = [...value.matchAll(/(\d+)\s*'/g)].map((m) => Number(m[1]));
  return { count, minutes };
}

export function isFlag(value: unknown): boolean {
  return toNumber(value) > 0;
}


// --- WPBakery content -------------------------------------------------------
// Content arrives with unrendered shortcodes and typographic quotes (&#8221;)
// in the attributes, so we decode it before searching.

/** Flickr photos embedded in a match, in large size. */
export function extractFlickrPhotos(html: string | undefined): string[] {
  if (!html) return [];
  const urls = [...decodeHtml(html).matchAll(/https:\/\/live\.staticflickr\.com\/[^"'\s)]+?\.jpg/g)].map(
    (m) => m[0],
  );
  // Flickr: _b = 1024px. Replace whatever size suffix it has.
  const large = urls.map((url) => url.replace(/(_[a-z])?\.jpg$/, "_b.jpg"));
  return [...new Set(large)];
}

export function extractYoutubeUrl(html: string | undefined): string | null {
  if (!html) return null;
  const match = decodeHtml(html).match(/vc_video link=["”″]?(https?:\/\/[^"”″\s\]]+)/);
  return match ? decodeHtml(match[1]) : null;
}

export function extractFlickrAlbum(html: string | undefined): string | null {
  if (!html) return null;
  const match = decodeHtml(html).match(/https:\/\/www\.flickr\.com\/photos\/[^"'\s]+\/albums\/\d+/);
  return match ? match[0] : null;
}

/** Id of the media used as the team header (first vc_single_image). */
export function extractHeaderMediaId(html: string | undefined): number | null {
  if (!html) return null;
  const match = decodeHtml(html).match(/vc_single_image image=["”″]?(\d+)/);
  return match ? Number(match[1]) : null;
}

/** *-CABECERA.jpg headers are the silhouette template, not a photo. */
export function isPlaceholderTeamPhoto(url: string): boolean {
  return /cabecera/i.test(url.split("/").pop() ?? "");
}


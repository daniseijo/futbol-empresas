import { leagueCrestUrl } from "@/lib/crests";
import { crestDataUrl } from "@/lib/og";

/** A crest's league URL keeps its file: a changed crest is a new upload, so a stored one never changes. */
const STORED = "public, max-age=31536000, s-maxage=31536000, immutable";
/** One the sync has not copied yet may arrive with the next run. */
const MISSING = "public, max-age=3600, s-maxage=3600";

/**
 * A team crest, from the copy the sync keeps in the database (see src/lib/crests.ts), cached for good by
 * the browser and the CDN. One the database lacks redirects to the league, as the site did before.
 */
export async function GET(_request: Request, { params }: RouteContext<"/escudos/[...path]">) {
  const url = leagueCrestUrl((await params).path);
  if (!url) return new Response("Not found", { status: 404 });
  const dataUrl = await crestDataUrl(url);
  const match = dataUrl?.match(/^data:(image\/[\w.+-]+);base64,(.*)$/);
  if (!match) return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": MISSING } });
  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "Content-Type": match[1], "Cache-Control": STORED },
  });
}

import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema } from "@/db/client";
import { DATA_TAG } from "@/lib/data";
import { leagueUploadUrl } from "@/lib/uploads";

/** The tables where the sync keeps its copies of the league's images (see src/lib/uploads.ts). */
const TABLES = { crests: schema.crests, photos: schema.playerPhotos };
export type StoredImageKind = keyof typeof TABLES;

/**
 * The stored copy of a league image as a data URL, or null when there is none: not downloaded yet, gone
 * from the league, or (for a crest) in a format the share images cannot draw. One primary key read.
 */
export async function storedDataUrl(kind: StoredImageKind, url: string | null): Promise<string | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(DATA_TAG);
  if (!url) return null;
  const table = TABLES[kind];
  try {
    const [row] = await db.select({ dataUrl: table.dataUrl }).from(table).where(eq(table.url, url));
    return row?.dataUrl ?? null;
  } catch {
    // The table arrives with the sync's migration, which can run after the deploy.
    return null;
  }
}

/** A stored file's league URL keeps its name: a changed image is a new upload, so a stored one never changes. */
const STORED = "public, max-age=31536000, s-maxage=31536000, immutable";
/** One the sync has not copied may arrive with its next run. */
const MISSING = "public, max-age=3600, s-maxage=3600";

/**
 * The response of /escudos/… and /fotos/…: the stored copy, cached for good by the browser and the CDN,
 * or a redirect to the league's file when there is none, as the site loaded them before.
 */
export async function storedImageResponse(kind: StoredImageKind, segments: string[]): Promise<Response> {
  const url = leagueUploadUrl(segments);
  if (!url) return new Response("Not found", { status: 404 });
  const match = (await storedDataUrl(kind, url))?.match(/^data:(image\/[\w.+-]+);base64,(.*)$/);
  if (!match) return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": MISSING } });
  return new Response(Buffer.from(match[2], "base64"), { headers: { "Content-Type": match[1], "Cache-Control": STORED } });
}

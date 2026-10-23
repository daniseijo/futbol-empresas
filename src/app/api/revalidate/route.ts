import { revalidateTag } from "next/cache";
import { DATA_TAG, SEARCH_TAG } from "@/lib/data";

/**
 * The sync (GitHub Actions) calls this when it finishes so the site stops
 * serving stale data. Protected by REVALIDATE_SECRET. The search index is only
 * rebuilt when the sync says something it shows changed (`{ "search": true }`).
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { search?: boolean };
  revalidateTag(DATA_TAG, "max");
  if (body.search) revalidateTag(SEARCH_TAG, "max");
  return Response.json({ ok: true, search: Boolean(body.search) });
}

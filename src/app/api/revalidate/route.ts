import { revalidateTag } from "next/cache";
import { DATA_TAG } from "@/lib/data";

/**
 * The sync (GitHub Actions) calls this when it finishes so the site stops
 * serving stale data. Protected by REVALIDATE_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag(DATA_TAG, "max");
  return Response.json({ ok: true });
}

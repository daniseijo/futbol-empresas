import { getSearchIndex } from "@/lib/data";

/**
 * The header search's index (teams and players). Prerendered and cached like
 * the pages, and refreshed when the sync revalidates the data, so a search
 * never reaches the database.
 */
export async function GET() {
  return Response.json(await getSearchIndex());
}

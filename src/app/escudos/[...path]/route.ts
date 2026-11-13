import { storedImageResponse } from "@/lib/stored-images";

/** A team crest, from the copy the sync keeps (see src/lib/uploads.ts). */
export async function GET(_request: Request, { params }: RouteContext<"/escudos/[...path]">) {
  return storedImageResponse("crests", (await params).path);
}

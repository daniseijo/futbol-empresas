import { storedImageResponse } from "@/lib/stored-images";

/** A player's photo, from the copy the sync keeps (see src/lib/uploads.ts). */
export async function GET(_request: Request, { params }: RouteContext<"/fotos/[...path]">) {
  return storedImageResponse("photos", (await params).path);
}

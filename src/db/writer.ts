import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let writer: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * The site's only writes: the Slack subscriptions (src/app/api/slack). Vercel's
 * DATABASE_AUTH_TOKEN is read-only, so they use a token of their own,
 * DATABASE_WRITE_AUTH_TOKEN, which nothing else gets. Locally (data/futbol.db)
 * no token is needed.
 */
export function writableDb() {
  if (!writer) {
    const url = process.env.DATABASE_URL ?? "file:data/futbol.db";
    const authToken = process.env.DATABASE_WRITE_AUTH_TOKEN;
    if (!url.startsWith("file:") && !authToken) throw new Error("DATABASE_WRITE_AUTH_TOKEN is not set");
    writer = drizzle(createClient({ url, authToken }), { schema });
  }
  return writer;
}

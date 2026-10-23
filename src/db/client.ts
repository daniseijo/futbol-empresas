import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Locally a SQLite file (data/futbol.db). In production, a Turso database:
 * just set DATABASE_URL=libsql://... and DATABASE_AUTH_TOKEN.
 */
const url = process.env.DATABASE_URL ?? "file:data/futbol.db";
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

if (url.startsWith("file:")) {
  // Locally the site and the sync read at the same time: WAL allows reading
  // while writing and busy_timeout waits instead of failing with SQLITE_BUSY.
  void client.executeMultiple("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
}

export const db = drizzle(client, { schema });
export { schema };

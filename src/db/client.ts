import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * En local es un fichero SQLite (data/futbol.db). En producción, una base de
 * datos de Turso: basta con DATABASE_URL=libsql://... y DATABASE_AUTH_TOKEN.
 */
const url = process.env.DATABASE_URL ?? "file:data/futbol.db";
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

if (url.startsWith("file:")) {
  // En local leen a la vez la web y la sincronización: WAL permite leer
  // mientras se escribe y busy_timeout espera en vez de fallar con SQLITE_BUSY.
  void client.executeMultiple("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
}

export const db = drizzle(client, { schema });
export { schema };

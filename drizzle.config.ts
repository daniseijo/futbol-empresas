import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // "turso" usa libSQL: sirve igual para un fichero local (file:) que para Turso (libsql://).
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:data/futbol.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});

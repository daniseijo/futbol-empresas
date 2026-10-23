import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // "turso" uses libSQL: it works both for a local file (file:) and for Turso (libsql://).
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:data/futbol.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});

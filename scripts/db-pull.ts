// Usage:
//   pnpm db:pull                         copies the production database (Turso) into data/futbol.db
//   pnpm db:pull -- --out=other.db       somewhere else
// Needs the Turso CLI, logged in (`turso auth login`), and sqlite3. The
// database is `futbolempresas` unless TURSO_DATABASE says otherwise.
//
// For development, screenshots and agents: reading the local copy costs no
// Turso quota, while a dev session against production reads 1-3M rows an hour.
// A pull reads every row once (~200,000). Stop `pnpm dev` first: it keeps the
// old file open and goes on serving it.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";

const database = process.env.TURSO_DATABASE ?? "futbolempresas";
const out = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? "data/futbol.db";
const temp = `${out}.pull`;

/**
 * `turso db shell <db> .dump | sqlite3 <file>`. sqlite3 loads the ~20 MB dump
 * in seconds; the libSQL client's executeMultiple takes minutes.
 */
function pullInto(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dump = spawn("turso", ["db", "shell", database, ".dump"], { stdio: ["ignore", "pipe", "inherit"] });
    const load = spawn("sqlite3", ["-bail", file], { stdio: ["pipe", "inherit", "inherit"] });
    dump.stdout.pipe(load.stdin);
    const missing = (tool: string, hint: string) => (error: Error) => reject(new Error(`Could not run ${tool} (${error.message}): ${hint}`));
    dump.on("error", missing("the Turso CLI", "install it and run turso auth login"));
    load.on("error", missing("sqlite3", "install it"));
    dump.on("close", (code) => {
      if (code !== 0) reject(new Error(`turso db shell ${database} .dump exited with ${code}`));
    });
    load.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`sqlite3 exited with ${code} while loading the dump`))));
  });
}

async function main() {
  mkdirSync(dirname(out), { recursive: true });
  rmSync(temp, { force: true });
  console.log(`Copying ${database}…`);
  // Loaded into a new file and swapped in at the end, so a failure leaves the old copy as it was.
  await pullInto(temp);
  const client = createClient({ url: `file:${temp}` });
  const { rows } = await client.execute("select count(*) as n from matches");
  client.close();

  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${out}${suffix}`, { force: true });
  renameSync(temp, out);
  console.log(`${out}: ${rows[0].n} matches, copied from ${database}`);
  if (existsSync(".env.local") && /^DATABASE_URL=/m.test(readFileSync(".env.local", "utf8"))) {
    console.log("Note: .env.local sets DATABASE_URL, so pnpm dev still reads Turso; remove it to use the copy.");
  }
}

main().catch((error) => {
  rmSync(temp, { force: true });
  console.error(error);
  process.exit(1);
});

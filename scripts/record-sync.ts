// Usage:
//   pnpm test:record-sync
// Records the league API responses that src/sync/run.test.ts replays offline.
// It runs the real sync, against a throwaway database, for a tiny slice of the
// league: one season, three teams, a dozen matches. Each request goes to the
// API (narrowed to the slice when it would ask for the whole league) and its
// response is trimmed to what the sync reads and saved in
// src/test/fixtures/sync/, keyed by URL. Re-record by hand when the API or the
// sync's requests change, and pick new ids for `SLICE` (src/test/sync-fixtures.ts)
// when the season changes.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURES_DIR, INDEX_FILE, normalizeUrl, SLICE, type FixtureIndex } from "@/test/sync-fixtures";

const realFetch = globalThis.fetch;

function hasContent(url: URL) {
  return (url.searchParams.get("_fields") ?? "").split(",").includes("content");
}

/** The request to send to the API instead of the sync's, or a status to answer with. */
function narrow(url: URL): URL | { status: number } {
  const narrowed = new URL(url);
  const path = url.pathname;
  if (path.endsWith("/sportspress/v2/teams") && !url.searchParams.has("include")) {
    narrowed.searchParams.set("include", SLICE.teamIds.join(","));
  }
  if (path.endsWith("/sportspress/v2/events")) {
    if (url.searchParams.has("seasons")) narrowed.searchParams.set("include", SLICE.matchIds.join(","));
    const ids = (narrowed.searchParams.get("include") ?? "").split(",").map(Number);
    if (hasContent(url) && ids.includes(SLICE.brokenMatchId)) return { status: 500 };
  }
  return narrowed;
}

/** Keeps only what the sync reads, so the fixtures stay small. */
function trim(url: URL, body: string, headers: Record<string, string>): string {
  const path = url.pathname;
  if (path.endsWith("/sportspress/v2/seasons")) {
    const kept = (JSON.parse(body) as { id: number }[]).filter((season) => season.id === SLICE.seasonId);
    headers["x-wp-total"] = String(kept.length);
    headers["x-wp-totalpages"] = "1";
    return JSON.stringify(kept);
  }
  if (path.endsWith("/wp/v2/media")) {
    // Only the sizes `fetchMediaUrls` and `fetchPlayerPhotos` pick from.
    const wanted = new Set(["sportspress-fit-icon", "thumbnail", "medium", "medium_large", "large", "full"]);
    const media = JSON.parse(body) as { media_details?: { sizes?: Record<string, { source_url: string }> } }[];
    for (const item of media) {
      const sizes = item.media_details?.sizes;
      if (!sizes) continue;
      item.media_details = {
        sizes: Object.fromEntries(Object.entries(sizes).filter(([name]) => wanted.has(name)).map(([name, size]) => [name, { source_url: size.source_url }])),
      };
    }
    return JSON.stringify(media);
  }
  if (path.endsWith("/sportspress/v2/lists")) {
    // Only the columns `fetchSquad` reads; the per-position lists only need their keys.
    const columns = ["name", "number", "appearances", "goals", "asistencia", "mvp", "valor", "crack", "dandy"];
    const lists = JSON.parse(body) as { data: Record<string, Record<string, unknown>> }[];
    for (const list of lists) {
      list.data = Object.fromEntries(
        Object.entries(list.data)
          .filter(([key]) => key !== "0")
          .map(([key, row]) => [key, Object.fromEntries(columns.filter((c) => c in row).map((c) => [c, c === "name" && row.name ? `Jugador ${key}` : row[c]]))]),
      );
    }
    return JSON.stringify(lists);
  }
  if (path.endsWith("/sportspress/v2/players")) {
    // Real names stay out of the repository (as data/futbol.db does).
    const players = JSON.parse(body) as { id: number; slug: string; title: { rendered: string } }[];
    return JSON.stringify(players.map((p) => ({ ...p, slug: `jugador-${p.id}`, title: { rendered: `Jugador ${p.id}` } })));
  }
  if (!url.pathname.startsWith("/wp-json") && url.hostname.endsWith("futbolempresas.es")) {
    // A match web page: only the section `parseMatchVideo` reads.
    const start = body.indexOf("sp-event-video");
    return start === -1 ? "" : `<div class="${body.slice(start, start + 4000)}`;
  }
  return body;
}

function fileName(url: URL, key: string, contentType: string): string {
  const name = url.pathname.split("/").filter(Boolean).pop() || "page";
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 10);
  return `${name}-${hash}.${contentType.includes("html") ? "html" : "json"}`;
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "record-sync-"));
  process.env.DATABASE_URL = `file:${join(dir, "sync.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.NEXT_PUBLIC_FOCUS_TEAM_SLUG = "embat";

  rmSync(FIXTURES_DIR, { recursive: true, force: true });
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const index: FixtureIndex = {};

  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const key = normalizeUrl(url);
    const target = narrow(url);
    if (!(target instanceof URL)) {
      index[key] = { status: target.status, contentType: "application/json", headers: {} };
      return new Response("", { status: target.status });
    }
    const res = await realFetch(target, init);
    const contentType = res.headers.get("content-type") ?? "application/json";
    const headers: Record<string, string> = {};
    for (const name of ["x-wp-total", "x-wp-totalpages"]) {
      const value = res.headers.get(name);
      if (value !== null) headers[name] = value;
    }
    const body = res.ok ? trim(url, await res.text(), headers) : "";
    const file = body ? fileName(url, key, contentType) : undefined;
    if (file) writeFileSync(join(FIXTURES_DIR, file), body);
    index[key] = { status: res.status, file, contentType: contentType.split(";")[0], headers };
    return new Response(body, { status: res.status, headers: { "content-type": contentType, ...headers } });
  };

  const { runSync } = await import("@/sync/run");
  const result = await runSync();
  if (result.pending.length > 0) throw new Error(`The sync did not finish: ${result.pending.join(", ")}`);

  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(INDEX_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  rmSync(dir, { recursive: true, force: true });
  console.log(`Recorded ${Object.keys(index).length} responses in ${FIXTURES_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

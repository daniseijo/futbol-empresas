// The whole sync, end to end and offline: `runSync` against a throwaway
// database, with `fetch` answering from the responses recorded by
// `pnpm test:record-sync` (src/test/fixtures/sync/). Any request without a
// recording fails the test.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it, mock } from "node:test";
import type { RawEvent } from "@/lib/sportspress/raw";
import { fakeFetch, loadFixtures, readFixtureBody, SLICE, type FakeFetch, type FixtureIndex } from "@/test/sync-fixtures";

// `src/db/client.ts` reads DATABASE_URL when it is imported: set it first, import later.
const dir = mkdtempSync(join(tmpdir(), "sync-test-"));
process.env.DATABASE_URL = `file:${join(dir, "sync.db")}`;
delete process.env.DATABASE_AUTH_TOKEN;
process.env.NEXT_PUBLIC_FOCUS_TEAM_SLUG = "embat";

type Modules = typeof import("@/db/client") & typeof import("@/sync/run") & typeof import("drizzle-orm");
let m: Modules;
let fixtures: FixtureIndex;
let fake: FakeFetch;
const realFetch = globalThis.fetch;

const EMBAT = 131846;
const INSPARYA = 131486;
const EY = 9373;
/** EY Abogados – Embat, 4-2: the match the second run changes. */
const CHANGED_MATCH = 133423;
/** Embat – OVB Allfinanz, not played yet. */
const NEXT_MATCH = 134299;
/** Two players with a private profile, in the lineup of 131988. */
const PRIVATE_PLAYERS = [123231, 123240];
/** A player id the recordings do not know. */
const NEW_PLAYER = 999_999_001;

/** 13:00 in Madrid. */
const START = new Date("2026-10-26T12:00:00Z");
const HOUR = 60 * 60 * 1000;

/** The recorded events of the slice, as the API returns them (without `content`). */
function recordedEvents(): (RawEvent & { modified: string })[] {
  const [, page] = Object.entries(fixtures).find(([url, r]) => url.includes("seasons=") && url.includes("/events?") && r.status === 200)!;
  return JSON.parse(readFixtureBody(page));
}

function recordedContent(id: number): RawEvent["content"] {
  for (const [url, r] of Object.entries(fixtures)) {
    if (!url.includes("_fields=id%2Ccontent") || !url.includes("/events?") || r.status !== 200) continue;
    const found = (JSON.parse(readFixtureBody(r)) as Pick<RawEvent, "id" | "content">[]).find((e) => e.id === id);
    if (found) return found.content;
  }
  return undefined;
}

/** The API's answer to "modified after": these events, and no team changed. */
function modifiedAfter(events: (RawEvent & { modified?: string })[]) {
  fake.override((url) => url.pathname.endsWith("/teams") && url.searchParams.has("modified_after"), { body: [] });
  fake.override((url) => url.pathname.endsWith("/events") && url.searchParams.has("modified_after"), {
    body: events,
    headers: { "x-wp-total": String(events.length), "x-wp-totalpages": "1" },
  });
}

async function run(options: Parameters<Modules["runSync"]>[0] = {}) {
  const lines: string[] = [];
  fake.unknown.length = 0;
  const result = await m.runSync({ ...options, log: (line) => lines.push(line) });
  assert.deepEqual(fake.unknown, [], "every request has a recording");
  return { ...result, lines };
}

const matchRows = () => m.db.select().from(m.schema.matches).orderBy(m.schema.matches.id);
const match = async (id: number) => (await m.db.select().from(m.schema.matches).where(m.eq(m.schema.matches.id, id)))[0];
const teamRows = () => m.db.select().from(m.schema.teams).orderBy(m.schema.teams.id);
const count = async (table: Parameters<typeof m.db.$count>[0]) => m.db.$count(table);

async function emptyDatabase() {
  const tables = await m.db.all<{ name: string }>(
    m.sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name != '__drizzle_migrations'`,
  );
  for (const { name } of tables) await m.db.run(m.sql.raw(`delete from "${name}"`));
}

before(async () => {
  fixtures = loadFixtures();
  fake = fakeFetch(fixtures);
  globalThis.fetch = fake.fetch;
  mock.timers.enable({ apis: ["Date"], now: START });
  const client = await import("@/lib/sportspress/client");
  client.RETRY_DELAYS_MS.fill(0);
  m = { ...(await import("@/db/client")), ...(await import("@/sync/run")), ...(await import("drizzle-orm")) };
});

after(() => {
  globalThis.fetch = realFetch;
  mock.timers.reset();
  rmSync(dir, { recursive: true, force: true });
});

describe("runSync", () => {
  it("fills every table on a first run and reports it is up to date", async () => {
    const result = await run();
    assert.deepEqual(result.pending, []);
    assert.match(result.lines.at(-1)!, /^All up to date/);
    assert.ok(result.writes > 0);
    assert.equal(result.searchChanged, true);

    assert.deepEqual(
      (await m.db.select().from(m.schema.seasons)).map((s) => s.id),
      [SLICE.seasonId],
    );
    assert.ok((await count(m.schema.leagues)) > 100);
    assert.deepEqual(
      (await matchRows()).map((row) => row.id),
      SLICE.matchIds,
    );
    const teams = await teamRows();
    assert.deepEqual(
      teams.map((t) => t.id),
      [...SLICE.teamIds].sort((a, b) => a - b),
    );
    for (const team of teams) {
      assert.ok(team.logoUrl, `${team.name} has a crest`);
      assert.equal(team.detailSyncedAt, "2026-10-26T13:00");
      assert.equal(team.squadSyncedAt, "2026-10-26T13:00");
      const squad = await m.db.$count(m.schema.squadPlayers, m.eq(m.schema.squadPlayers.teamId, team.id));
      assert.ok(squad > 5, `${team.name} has a squad`);
    }

    const played = (await matchRows()).filter((row) => row.played);
    assert.ok(played.length >= 5);
    for (const row of played) {
      assert.notEqual(row.homeGoals, null);
      const lineup = await m.db.$count(m.schema.matchPlayers, m.eq(m.schema.matchPlayers.matchId, row.id));
      assert.ok(lineup > 0, `match ${row.id} has lineups`);
      assert.equal(row.videoCheckedAt, "2026-10-26T13:00");
    }
    assert.ok(played.some((row) => row.videoId), "some match has a video");
    assert.equal((await match(NEXT_MATCH)).played, false);

    // Every lineup player has a row; the private ones without a name.
    const unknown = await m.db.all(m.sql`select 1 from match_players mp left join players p on p.id = mp.player_id where p.id is null`);
    assert.deepEqual(unknown, []);
    for (const id of PRIVATE_PLAYERS) {
      const [player] = await m.db.select().from(m.schema.players).where(m.eq(m.schema.players.id, id));
      assert.equal(player.name, "");
    }
    assert.ok((await count(m.schema.tournaments)) > 0);
    assert.ok((await count(m.schema.news)) > 0);
  });

  it("keeps going when WordPress cannot render a match's content", async () => {
    // The page of matches failed with a 500, and so did every chunk of content with the broken match.
    const broken = await match(SLICE.brokenMatchId);
    assert.equal(broken.played, true);
    assert.deepEqual(broken.photos, []);
    assert.ok((await match(CHANGED_MATCH)).photos.length > 0, "the other matches keep their photos");
  });

  it("updates only what changed on the next run, and refreshes those two squads", async () => {
    const before = await matchRows();
    const teamsBefore = await teamRows();
    mock.timers.tick(3 * HOUR);
    fake.requests.length = 0;
    const event = recordedEvents().find((e) => e.id === CHANGED_MATCH)!;
    assert.deepEqual(event.main_results, ["4", "2"]);
    modifiedAfter([{ ...event, main_results: ["4", "3"], modified: "2026-10-26T15:30:00", content: recordedContent(CHANGED_MATCH) }]);

    const result = await run();
    assert.deepEqual(result.pending, []);
    assert.ok(result.lines.some((line) => line.startsWith("Changes since 2026-10-26T13:00: 0 teams updated, 1 matches updated (2 squads to refresh)")));
    assert.ok(
      fake.requests.some((url) => url.includes("modified_after=2026-10-26T12%3A00%3A00")),
      "asks for changes since the last run, minus the overlap",
    );

    const after = await matchRows();
    for (const [i, row] of after.entries()) {
      if (row.id !== CHANGED_MATCH) assert.deepEqual(row, before[i], `match ${row.id} is untouched`);
    }
    const changed = after.find((row) => row.id === CHANGED_MATCH)!;
    assert.equal(changed.awayGoals, 3);
    assert.equal(changed.modified, "2026-10-26T15:30:00");
    assert.ok(changed.photos.length > 0);
    assert.ok(changed.videoId, "keeps its video");

    const synced = Object.fromEntries((await teamRows()).map((t) => [t.id, t.squadSyncedAt]));
    assert.equal(synced[EY], "2026-10-26T16:00");
    assert.equal(synced[EMBAT], "2026-10-26T16:00");
    assert.equal(synced[INSPARYA], teamsBefore.find((t) => t.id === INSPARYA)!.squadSyncedAt);
  });

  it("saves a match with a score as played even if the API says it is in the future, and names new players", async () => {
    mock.timers.tick(HOUR);
    const event = recordedEvents().find((e) => e.id === NEXT_MATCH)!;
    assert.equal(event.status, "future");
    // With a scorer never seen before, whose profile is private.
    const performance = { [EMBAT]: { [NEW_PLAYER]: { number: "9", goals: "1" } } };
    modifiedAfter([{ ...event, main_results: ["1", "0"], performance }]);
    fake.override((url) => url.pathname.endsWith("/players") && url.searchParams.get("include") === String(NEW_PLAYER), { body: [] });
    // Now played, its web page is checked for a video: none yet.
    fake.override((url) => url.searchParams.get("p") === String(NEXT_MATCH), { body: "", headers: { "content-type": "text/html" } });

    await run();
    const saved = await match(NEXT_MATCH);
    assert.equal(saved.played, true);
    assert.equal(saved.homeGoals, 1);
    assert.equal(saved.awayGoals, 0);
    const [scorer] = await m.db.select().from(m.schema.players).where(m.eq(m.schema.players.id, NEW_PLAYER));
    assert.equal(scorer?.name, "", "the new player was looked up and saved without a name");
    assert.equal(scorer.lastTeamId, EMBAT);
  });

  it("stops between tasks when the budget runs out, and the next run resumes", async () => {
    await emptyDatabase();
    fake.clearOverrides();
    // Each match web page takes 10 s: the budget runs out while looking for videos.
    fake.onRequest = (url) => {
      if (url.searchParams.get("post_type") === "sp_event") mock.timers.tick(10_000);
    };
    try {
      const paused = await run({ budgetSeconds: 15 });
      assert.match(paused.pending[0], /^Current season videos \(\d+ matches left\)$/);
      assert.ok(!paused.pending.some((task) => /^(Matches|Focus team|Scorer names)/.test(task)), "earlier tasks finished");
      assert.match(paused.lines.at(-1)!, /^Paused after \d+ s\. Pending: Current season videos/);
      assert.equal(await count(m.schema.matches), SLICE.matchIds.length);
      const unchecked = await m.db.$count(m.schema.matches, m.and(m.eq(m.schema.matches.played, true), m.isNull(m.schema.matches.videoCheckedAt)));
      assert.ok(unchecked > 0, "some videos were left for later");
    } finally {
      fake.onRequest = undefined;
    }

    modifiedAfter([]);
    const resumed = await run();
    assert.deepEqual(resumed.pending, []);
    const unchecked = await m.db.$count(m.schema.matches, m.and(m.eq(m.schema.matches.played, true), m.isNull(m.schema.matches.videoCheckedAt)));
    assert.equal(unchecked, 0);
  });
});

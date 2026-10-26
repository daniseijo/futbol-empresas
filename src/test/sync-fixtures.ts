// Recorded league API responses for the end-to-end sync test (src/sync/run.test.ts).
// `scripts/record-sync.ts` writes them; `fakeFetch` serves them offline.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The slice: season 26/27, Embat (the default focus team) and two rivals of its group. */
export const SLICE = {
  seasonId: 740,
  teamIds: [131846, 131486, 9373],
  /**
   * Every match of those teams in October 2026 (played with and without video,
   * one postponed, the next ones), and 131988, from another group, whose
   * lineup has two players with a private profile.
   */
  matchIds: [131988, 132045, 132944, 132950, 133417, 133423, 133793, 133795, 133799, 134292, 134299, 134301],
  /**
   * A match whose `content` WordPress cannot render (a persistent 500, as
   * 86748 does in 23/24). None of the slice really fails, so the recorder
   * answers 500 to every request of its `content`, as the API would.
   */
  brokenMatchId: 133795,
};

export const FIXTURES_DIR = "src/test/fixtures/sync";
export const INDEX_FILE = join(FIXTURES_DIR, "index.json");

/** One recorded response. `file` is missing when the body is empty (a 500). */
export interface RecordedResponse {
  status: number;
  file?: string;
  contentType: string;
  /** Only the headers the sync reads: `x-wp-total` and `x-wp-totalpages`. */
  headers: Record<string, string>;
}

/** URL → response, keyed by `normalizeUrl`. */
export type FixtureIndex = Record<string, RecordedResponse>;

/** The same URL whatever the order of its query string. */
export function normalizeUrl(input: string | URL): string {
  const url = new URL(input);
  const params = [...url.searchParams.entries()].sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  return `${url.origin}${url.pathname}${params.length ? `?${new URLSearchParams(params)}` : ""}`;
}

export function loadFixtures(): FixtureIndex {
  return JSON.parse(readFileSync(INDEX_FILE, "utf8")) as FixtureIndex;
}

export function readFixtureBody(recorded: RecordedResponse): string {
  return recorded.file ? readFileSync(join(FIXTURES_DIR, recorded.file), "utf8") : "";
}

/** A response made up by a test instead of read from the recordings. */
export interface Override {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface FakeFetch {
  fetch: typeof fetch;
  /** Every URL requested, normalised, in order. */
  requests: string[];
  /** URLs with no recording: each one also fails its request. */
  unknown: string[];
  /** Serves `override` instead of the recording for the URLs `matches` accepts; the latest one added wins. */
  override(matches: (url: URL) => boolean, override: Override): void;
  clearOverrides(): void;
  /** Runs before answering each request (e.g. to move a fake clock forward). */
  onRequest?: (url: URL) => void;
}

/**
 * A `fetch` that answers from the recordings and fails loudly on any URL it
 * does not know, so a new request in the sync shows up as a test failure.
 */
export function fakeFetch(index: FixtureIndex): FakeFetch {
  const overrides: { matches: (url: URL) => boolean; override: Override }[] = [];
  const fake: FakeFetch = {
    requests: [],
    unknown: [],
    override: (matches, override) => void overrides.unshift({ matches, override }),
    clearOverrides: () => void overrides.splice(0),
    fetch: async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const key = normalizeUrl(url);
      fake.requests.push(key);
      fake.onRequest?.(url);
      const override = overrides.find((o) => o.matches(url))?.override;
      if (override) {
        const body = typeof override.body === "string" ? override.body : JSON.stringify(override.body);
        return new Response(body, { status: override.status ?? 200, headers: override.headers });
      }
      const recorded = index[key];
      if (!recorded) {
        fake.unknown.push(key);
        throw new Error(`No recorded response for ${key}. Re-record with \`pnpm test:record-sync\` (see README).`);
      }
      return new Response(recorded.status === 500 ? "" : readFixtureBody(recorded), {
        status: recorded.status,
        headers: { "content-type": recorded.contentType, ...recorded.headers },
      });
    },
  };
  return fake;
}

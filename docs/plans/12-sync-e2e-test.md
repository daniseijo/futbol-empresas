# 12 · End-to-end sync test

## Why

The sync (`src/sync/run.ts`, `src/sync/fetch.ts`) is what keeps the site right, and only its pure pieces are tested
(`mapEvent` in `fetch.test.ts`, the parsers in `parse.test.ts`). The orchestration (incremental changes, backfill
order, the time budget, squads refreshed for touched teams, videos, migrations) is only checked by running it against
the real API, which is slow (0.2–12 s per call) and changes every day. A refactor of `run.ts` can break production
without CI noticing.

## What to build

1. **Recorded responses.** A small script, `scripts/record-sync.ts`, that runs the sync's fetches for a tiny slice of
   the league (one season, one group, ~3 teams, ~10 matches including one with a video, one 500 match and one with a
   private player) and saves each response to `src/test/fixtures/sync/` as JSON/HTML keyed by URL. Trim them to what
   the sync reads; keep them under ~1 MB in total. Record once, commit, re-record by hand when the API changes.
2. **A fake `fetch`.** In the test, replace `globalThis.fetch` with one that serves the recorded file for each URL
   (normalised query string order) and fails loudly on any URL it does not know, so a new request shows up as a test
   failure. Headers matter: `x-wp-total` and `x-wp-totalpages` drive pagination. Make the retry delays
   (`RETRY_DELAYS_MS` in `src/lib/sportspress/client.ts`) injectable or zero in tests.
3. **A throwaway database.** `src/db/client.ts` reads `DATABASE_URL` at import time; point it at a temporary file
   (`file:<tmpdir>/sync-test.db`) before importing. `runSync` applies the migrations itself.
4. **Tests** (`src/sync/run.test.ts`):
   - a first run fills seasons, leagues, teams, matches, lineups, players and squads, and reports "All up to date";
   - a second run with a "modified after" response that changes one score updates only that match and refreshes the
     two teams' squads;
   - `budgetSeconds` stops between tasks and reports what is pending (fake the clock or use a budget of 0/1);
   - a 500 on a match's `content` does not stop the run (`failFastOn500`);
   - a match with a score and `status: future` is saved as played; a private player is saved with an empty name.
5. Run it in `pnpm test` (it must take seconds, not minutes) so CI covers it.

## Done when

- `pnpm test` runs the sync end to end offline in under ~10 s.
- Breaking a step of `runSync` on purpose (e.g. skipping `syncSquad` for touched teams) makes a test fail.
- `README.md` explains how to re-record the fixtures.

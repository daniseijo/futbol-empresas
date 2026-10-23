# 02 · Unit tests

## Why

There are no tests. Several rules decide what users see and are easy to break without noticing:

- whether a team's summary leads with the **last result or the next match's preview** (`PREVIEW_DAYS`);
- how **cards** are read from the API's counts (straight red vs second yellow);
- the "Sube a 7º / Baja a 9º / Sigue 9º" and "A 1 punto de Kearney" texts;
- standings (points, tiebreakers, form) and the parsing of the API's titles, goals with minute and shortcodes.

## What to build

A test runner, tests for the logic above, and a CI job that runs lint, types and tests on every push.

## How

1. **Runner:** Node's built-in `node:test` with `tsx`, which is already a dev dependency and understands the `@/`
   path alias from `tsconfig.json`. No new dependency. Add to `package.json`:
   `"test": "node --import tsx --test \"src/**/*.test.ts\""` (Node 24 expands the glob). Put tests next to the
   code (`standings.test.ts` beside `standings.ts`). If `tsx` cannot resolve the alias, fix that rather than
   switching to relative imports.
2. **Make the rules pure and importable first.** Today some of them sit inside components or next to database
   calls:
   - `cardsFor` and `sendingOff` live in `src/components/player-events.tsx` (a `.tsx` with JSX). Move them to
     `src/lib/cards.ts` and re-export or import them from the component.
   - `trend` and `gap` are private functions in `src/components/featured-match.tsx`. Move them to
     `src/lib/views/featured.ts` (exported) and use them from the component.
   - In `getFeatured` (`src/lib/views/featured.ts`) the decision is mixed with `getMatchPageData`, which hits the
     database. Extract a pure `featuredMode(context, now): { mode, matchId, daysToNext }` and a pure
     `positionBefore(seasonMatches, groupId, teamId, round)`; `getFeatured` calls them.
3. **Tests to write** (build `Match` / `StandingRow` fixtures with small helper functions, not database data):
   - `featuredMode`: last match yesterday and next in 6 days → `result`; next in 2 days → `preview`; next today
     and not yet played → `preview`; no next match (end of season) → `result`; no last match (start of season) →
     `preview`; no matches at all → no featured match.
   - `cardsFor` / `sendingOff`: the five combinations seen in production — 1/0 yellow, 0/1 straight red, 1/1
     yellow then straight red, 2/1 and 2/0 second yellow — plus 0/0.
   - `trend` and `gap`: moving up, down, staying, unknown previous position; leader ahead, leader tied, tied with
     the team above, 1 point vs several points (singular / plural).
   - `computeStandings` (`src/lib/standings.ts`): 3/1/0 points, tiebreak by goal difference then goals scored then
     name, unplayed matches ignored, a match with a score but status "future" counted, form order (oldest first,
     at most 5).
   - `src/lib/sportspress/parse.ts`: `parseEventTitle` ("J3 – EY Abogados vs Embat", "J1- Simon Kucher vs …"
     with the round stuck to the name, no round prefix, HTML entities, team names with dashes), match sheet goals
     ("2 (42', 44')" → 2 goals at 42 and 44; a count without minutes), and unrendered shortcodes. Read the
     "Known API oddities" in `docs/plan.md` and turn each into a case where it applies.
   - `daysBetween` and `relativeDay` (`src/lib/dates.ts`) across a month boundary.
4. **CI:** a new `.github/workflows/ci.yml` on `push` and `pull_request`: checkout, pnpm, Node 24 (copy the setup
   steps from `sync.yml`), `pnpm install --frozen-lockfile`, `pnpm lint`, `npx next typegen`, `npx tsc --noEmit`,
   `pnpm test`. It needs no secrets: nothing here touches the database.

## Done when

- `pnpm test` runs and passes locally, and the CI workflow is green on the branch.
- Every bullet in step 3 has at least one test; the moved functions are used from their new place and the site
  behaves exactly as before (check the home page and a match page).
- `docs/plan.md`'s "Unit tests" item is ticked (leave the end-to-end sync test open).

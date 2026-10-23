# Plan

Tasks ready to hand to an agent are in [`plans/`](plans/README.md).

What is left to do, in priority order. Each block is independent.

## 1. Finish the data backfill

Status (23/10/2026): all five seasons (26/27 to 22/23) fully loaded into Turso, with lineups and player
names. Only the archive videos are left; the scheduled GitHub action keeps checking them.

- [x] Run `pnpm sync` until it says "All up to date" (only "Videos (archive)" is pending).
- [x] ~~Names of players with a private profile~~: they cannot be fetched. The league hides them everywhere:
  the API returns 404, they are missing from the match page and the squad lists, and their web profile is a 404.
  Only their id remains on the API match sheet, so the site shows them by shirt number ("Dorsal 7").
- [ ] Past season videos: the "Videos (archive)" task is last in the queue; check how many it finds
  (about 3 in 4 matches so far).

## 2. Deployment (Vercel + Turso + GitHub Actions)

See the steps in the README.

- [x] Create the Turso database and import the local one.
- [x] Connect the repository to Vercel with `DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `REVALIDATE_SECRET`.
- [x] GitHub secrets for the sync action and `SYNC_ENABLED=true`.
- [ ] Check the first scheduled runs. The repository is public (unlimited Actions minutes), but GitHub
  disables schedules on public repositories after 60 days without commits. `SYNC_ENABLED` was created on
  23 Oct 2026 at 06:27 UTC; every scheduled run before that was `skipped`. Plan:
  [03 · Sync monitoring](plans/03-sync-monitoring.md).

## 3. New pages

- [x] **Group / competition** (`/competiciones/...`): standings, browsable rounds, top scorers and the group's
  Crack, linked from the home page, the match page and the team standings.
  - [ ] Cups without groups (Corporate Cup): they now show a table with all their teams; a bracket or a list
    of knockout rounds would be better.
- [x] **Player** (`/jugadores/[id]`): matches, goals with minute, MVP, teams per season and photo, linked from
  lineups, top scorers, Crack, squad and team leaders.
- [x] **Venue** (`/campos/[id]`, index at `/campos`): OpenStreetMap embed, address, the next date with matches
  there, the rest of the season and who plays there most, linked from every venue name. Plan:
  [04 · Venue page](plans/04-venue-page.md).
- [ ] **Women's league**: check that the home page and teams work well with its competitions. Plan:
  [07 · Women's league](plans/07-womens-league.md).
- [x] **Matches of a day** (`/partidos/dia/[fecha]`): grouped by time or venue (`?orden=campo`), with previous and
  next dates with matches, linked from the home page's match strip and the match page's "Resto de la jornada".
  Current season only.

## 4. Improvements to what exists

- [x] Home page: if there are no matches today, show the next round and the latest results instead of
  "0 partidos". The home page now shows the next date with matches, and the focus team's last result or next
  match's preview (also on the team summary).
- [ ] Match page: lineups on a pitch (optional).
- [ ] Team: a "Share" button in the site's style. Plan: [06 · Sharing and SEO](plans/06-share-and-seo.md).
- [ ] Search: search players too. Plan: [05 · Player search](plans/05-player-search.md).
- [ ] SEO: `sitemap.xml`, Open Graph images per match and team. Plan:
  [06 · Sharing and SEO](plans/06-share-and-seo.md).
- [ ] A real 404 page: it currently answers 200 because the content is streamed. In development, the first load
  of a 404 sometimes throws "cannot have a negative time stamp" in `performance.measure` (from React, not the site).

## 5. Quality

- [x] Unit tests for `parse.ts` (titles, goals with minute, shortcodes), `standings.ts` and video matching, plus
  cards, the featured match rules, dates and the sync's match mapping. `pnpm test`; CI runs lint, types and tests
  on every push (`.github/workflows/ci.yml`).
- [ ] End-to-end test of the sync against recorded API responses.
- [ ] Accessibility review (coral on white contrast, focus, screen readers on the timeline).
- [ ] Alerts when the sync fails (e.g. a GitHub Actions notification). Plan:
  [03 · Sync monitoring](plans/03-sync-monitoring.md).

## Known API oddities

- Matches with a score and `status: future` (treated as played).
- Titles naming another team ("Roche Pharma" when Roche Femenino plays): the name comes from the linked team.
- The same player in both lineups of a match (a goalkeeper in the women's league): both rows are kept.
- The match sheet `position` is sometimes a string or an object instead of a list.
- Requests with `content` for several teams return 504; `/players` takes more than 10 s; `_embed` is very slow.
- Some matches make WordPress fail with a persistent 500 when rendering their `content` (e.g. 86748).

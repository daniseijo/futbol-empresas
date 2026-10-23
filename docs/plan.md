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
  (about 3 in 4 matches so far). Plan: [08 · Archive videos](plans/08-archive-videos.md).

## 2. Deployment (Vercel + Turso + GitHub Actions)

See the steps in the README.

- [x] Create the Turso database and import the local one.
- [x] Connect the repository to Vercel with `DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `REVALIDATE_SECRET`.
- [x] GitHub secrets for the sync action and `SYNC_ENABLED=true`.
- [x] Check the first scheduled runs. The first one with `SYNC_ENABLED` set succeeded on 23 Oct 2026
  ([run 39946236436](https://github.com/daniseijo/futbol-empresas/actions/runs/39946236436)), but GitHub
  started it at 11:27 UTC instead of 09:07 and dropped the 06:07 one; the night before, 5 of the ~21 match-night
  runs showed up (all `skipped` then). Scheduled runs work but are late or missing on busy hours.
- [x] Monthly keepalive against the 60-day schedule shutdown (`.github/workflows/keepalive.yml`).
- [x] Trigger the sync from an external cron on match nights so it does not depend on GitHub's schedule.
  Since 23 Oct 2026 cron-job.org calls `workflow_dispatch` every 20 minutes, 19:00–23:59 Madrid time, Monday to
  Friday, with a fine-grained token limited to Actions on this repository. Steps in the README ("Keeping an eye
  on the sync").

## 3. New pages

- [x] **Group / competition** (`/competiciones/...`): standings, browsable rounds, top scorers and the group's
  MVP, linked from the home page, the match page and the team standings.
  - [ ] Cups without groups (Corporate Cup): they now show a table with all their teams; a bracket or a list
    of knockout rounds would be better. Plan: [09 · Cup brackets](plans/09-cup-brackets.md).
- [x] **Player** (`/jugadores/[id]`): matches, goals with minute, MVP, teams per season and photo, linked from
  lineups, top scorers, MVP, squad and team leaders.
- [x] **Venue** (`/campos/[id]`, index at `/campos`): a map in the site's colours (MapLibre + OpenFreeMap), address, the next date with matches
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
- [ ] Match page: lineups on a pitch (optional). Plan: [10 · Lineups on a pitch](plans/10-lineups-on-pitch.md).
- [ ] Team: a "Share" button in the site's style. Plan: [06 · Sharing and SEO](plans/06-share-and-seo.md).
- [x] Search: search players too. Plan: [05 · Player search](plans/05-player-search.md). One index of teams and
  players (`/api/busqueda`, prerendered, ~80 KB with brotli) downloaded the first time the search box is used, and
  searched in the browser, so a search never reads Turso. The index has its own cache tag (`search`), revalidated
  only when the sync changes something it shows (~15,000 rows per rebuild). Players carry `last_team_id` and
  `last_match_date`, which the sync updates from the matches it saves (one primary key lookup per player).
- [ ] SEO: `sitemap.xml`, Open Graph images per match and team. Plan:
  [06 · Sharing and SEO](plans/06-share-and-seo.md).
- [ ] A real 404 page: it currently answers 200 because the content is streamed. In development, the first load
  of a 404 sometimes throws "cannot have a negative time stamp" in `performance.measure` (from React, not the site).
  Plan: [11 · A real 404](plans/11-real-404.md).

## 5. Quality

- [x] Unit tests for `parse.ts` (titles, goals with minute, shortcodes), `standings.ts` and video matching, plus
  cards, the featured match rules, dates and the sync's match mapping. `pnpm test`; CI runs lint, types and tests
  on every push (`.github/workflows/ci.yml`).
- [ ] End-to-end test of the sync against recorded API responses. Plan: [12 · End-to-end sync test](plans/12-sync-e2e-test.md).
- [ ] Accessibility review (coral on white contrast, focus, screen readers on the timeline). Plan:
  [13 · Accessibility review](plans/13-accessibility.md).
- [ ] Revalidate only what a sync changed, not the whole site: today almost every run invalidates every page (an
  archive video counts as a change). Measure first, once the archive video backfill ends. Plan:
  [14 · Targeted revalidation](plans/14-targeted-revalidation.md).
- [x] Alerts when the sync fails: a `sync-failure` issue that opens on failure and closes on the next success,
  and the footer's last sync date in red after 12 hours. Plan: [03 · Sync monitoring](plans/03-sync-monitoring.md).

## Known API oddities

- Matches with a score and `status: future` (treated as played).
- Titles naming another team ("Roche Pharma" when Roche Femenino plays): the name comes from the linked team.
- The same player in both lineups of a match (a goalkeeper in the women's league): both rows are kept.
- The match sheet `position` is sometimes a string or an object instead of a list.
- Requests with `content` for several teams return 504; `/players` takes more than 10 s; `_embed` is very slow.
- Some matches make WordPress fail with a persistent 500 when rendering their `content` (e.g. 86748).
- Rounds are published about a week ahead, so a phase in progress has far fewer matches than it will. Totals in
  the current season are estimated (`src/lib/expected-matches.ts`): a round robin per group, for groups that were
  one the season before.
- Round numbers are unreliable: some matches are played early under a later round (round 9 in October), and some
  have none.
- A match can be tagged with the wrong group (IBO – PWC S.A.D Curve, two Grupo 4 teams, in Grupo 3). The teams'
  `leagues` say where they really play, but only for the current season: they do not keep past groups.
- League tables (`/tables`) are no longer kept per group and season, so they cannot list a group's teams.
- Match videos are not in the API: SportsPress keeps them in the `sp_video` meta, which the REST API only shows in
  `context=edit` (401). The custom `futbolempresas/v1/match-video/{id}` endpoint exists but returned an empty
  `youtube_url` for every match checked in October 2026, and `wp/v2/videos` is empty, so the sync reads the video
  from the match's web page (`fetchMatchVideo`). Worth checking again if the league starts filling that endpoint.

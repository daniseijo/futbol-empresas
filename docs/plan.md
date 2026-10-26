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
- [x] Past season videos: the archive backfill finished on 23 Oct 2026 (4,762 matches checked in one run,
  4,138 with video). Plan: [08 · Archive videos](plans/08-archive-videos.md).

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
  - [ ] Cups without groups (Corporate Cup), and knockout or final matches tagged only with the competition
    (Copa de las Empresas, Liga Clausura, the women's leagues): they now show a standings table; a bracket or a
    list of knockout rounds would be better. Plan: [09 · Cup brackets](plans/09-cup-brackets.md).
- [x] **Player** (`/jugadores/[id]`): matches, goals with minute, MVP, teams per season and photo, linked from
  lineups, top scorers, MVP, squad and team leaders.
- [x] **Venue** (`/campos/[id]`, index at `/campos`): a map in the site's colours (MapLibre + OpenFreeMap), address, the next date with matches
  there, the rest of the season and who plays there most, linked from every venue name. Plan:
  [04 · Venue page](plans/04-venue-page.md).
- [x] **Women's league**: checked on 24 Oct 2026 with `telefonica-femenino` as the focus team (production data,
  read-only): the home page, every team tab, the match pages (including a goalkeeper in both lineups) and the
  competition pages work. The competition's group cards now wrap long names ("Segunda Fase - Grupo de Oro / de
  Plata" were cut to the same text), and private players show as "Dorsal 7" everywhere (`playerDisplayName`)
  instead of "Sin nombre" in lineups and squads. Plan: [07 · Women's league](plans/07-womens-league.md). Left as is:
  - The home page's top scorers, group leaders and big wins stay on the main competition (the men's Liga
    Apertura). With 5 teams and one group the women's league adds little there, and it is one click away from the
    focus team's standings card and the "Competiciones" card.
  - The finals played on the last day (matches tagged only with the competition, 539 and 542 in 24/25) show as a
    "Clasificación" table on the competition page. The men's Liga Clausura and the Copa de las Empresas have the
    same problem with their knockout matches: part of [09 · Cup brackets](plans/09-cup-brackets.md).
- [x] **Matches of a day** (`/partidos/dia/[fecha]`): grouped by time or venue (`?orden=campo`), with previous and
  next dates with matches, linked from the home page's match strip and the match page's "Resto de la jornada".
  Current season only.

## 4. Improvements to what exists

- [x] Home page: if there are no matches today, show the next round and the latest results instead of
  "0 partidos". The home page now shows the next date with matches, and the focus team's last result or next
  match's preview (also on the team summary).
- [ ] Match page: lineups on a pitch (optional). Plan: [10 · Lineups on a pitch](plans/10-lineups-on-pitch.md).
- [x] Match and team: a "Compartir" button in the header (`ShareButton`): the native share sheet where there is one
  (phones, Safari, Chrome on macOS), otherwise it copies the link. Plan: [06 · Sharing and SEO](plans/06-share-and-seo.md).
- [x] Search: search players too. Plan: [05 · Player search](plans/05-player-search.md). One index of teams and
  players (`/api/busqueda`, prerendered, ~80 KB with brotli) downloaded the first time the search box is used, and
  searched in the browser, so a search never reads Turso. The index has its own cache tag (`search`), revalidated
  only when the sync changes something it shows (~15,000 rows per rebuild). Players carry `last_team_id` and
  `last_match_date`, which the sync updates from the matches it saves (one primary key lookup per player).
- [x] SEO and link previews (25 Oct 2026): `metadataBase` from `NEXT_PUBLIC_SITE_URL`, descriptions on match and
  team pages, Open Graph images (`opengraph-image.tsx`) for matches (score, or date and time), teams (every tab:
  position, points, last five results) and the rest of the site, drawn with the site's fonts in `src/assets/fonts/`
  (Latin subsets). Match and team images reuse the pages' `generateStaticParams`, so they are cached and revalidated
  like the pages (5 min / 1 day) instead of drawn on every request. `sitemap.xml` (~7,900 URLs: current season
  competitions and matches, every team and venue, players with a name) and `robots.txt`. Plan:
  [06 · Sharing and SEO](plans/06-share-and-seo.md).
- [x] Call-ups on Telegram and Slack (25 Oct 2026): `pnpm notify` (`src/notify/`), a job after every sync,
  announces the focus team's matches from 14 days before and again if they are rescheduled, with a "¿Vas?" poll on
  Telegram. See "Match call-ups" in the README. Possible next steps: a reminder the day before, the result after
  the match, the standings context ("A 1 punto de…") in the message.
- [x] Slack subscriptions to any team's call-ups (25 Oct 2026): "Recibir convocatorias en Slack" on every team
  page, OAuth with the `incoming-webhook` scope, the webhook stored encrypted in `subscriptions`, and `pnpm notify`
  sends per target and drops revoked webhooks. See "Slack subscriptions" in the README. Next: the same for
  Telegram (a `?startgroup=<slug>` deep link to the bot), and maybe Slack's `app_uninstalled` event to drop
  subscriptions straight away instead of on the next call-up.
- [x] Slack call-ups at a time each channel picks (26 Oct 2026): each subscription picks a weekday (Monday to
  Friday) and a whole hour; each match goes out on the last such weekday before it, never on a weekend, and
  reschedules at once. `/slack/nuevo` before Slack, `/slack/avisos` (signed link in every message's footer) to
  change it or unsubscribe, and `notify.yml` on the hour from cron-job.org. Next: `/slack` as the bot's own page
  (what it sends, a team search to add it). Since 26 Oct the messages use their own image,
  `/partidos/<id>/convocatoria.png` (1200×400, crests, day and time), a third shorter than the share image.
- [ ] Let each visitor pick their own company (separate PR, after the Slack subscriptions): today "Mi equipo", the
  home page's "Tu equipo" and the app shortcut all come from the fixed `NEXT_PUBLIC_FOCUS_TEAM_SLUG`. A choice kept
  in a cookie, no accounts, would personalise them and could show the Slack button on the home page too. Watch the
  cost: the home page is prerendered with the fixed team, so the personal parts need `<Suspense>` (or the client)
  without slowing it down. The env-configured Telegram/Slack channels keep following the fixed team. Write a plan
  in `docs/plans/` first (how and when the visitor picks: first visit, menu…).
- [x] A real 404 page, as far as it goes without slowing pages down (24 Oct 2026). Plan:
  [11 · A real 404](plans/11-real-404.md). Measured on a production build:
  - Matches, teams (every tab) and venues answer 200 on the **first** visit of a missing URL and 404 from then on:
    with Partial Prefetching the first visit gets the skeleton straight away, then Next renders the URL in the
    background, reaches `notFound()` and caches a 404. Players now do the same: the route had no
    `generateStaticParams`, so it never cached a page and always answered 200. It now prerenders the focus team's
    squad, and visited players are cached too (more ISR entries: keep an eye on it in plan 14).
  - Competitions and day pages always answer 200: they read `searchParams` (`?temporada`, `?orden`), which keeps
    them dynamic. Fixing that means moving those options into the path.
  - Not done: a check before the `<Suspense>` would make every first visit wait for the database instead of
    showing the skeleton, which is what the Next docs warn against. A check in Proxy would run before the CDN cache
    on every page load of those routes (one function call and one Turso read each). Both cost every visitor to
    fix a case that `noindex` already keeps out of search engines.
  - The dev-only "cannot have a negative time stamp" error did not show up in five cold loads of 404 pages with
    Next 16.4.2 (browser console and server log); no upstream issue linked.

## 5. Quality

- [x] Unit tests for `parse.ts` (titles, goals with minute, shortcodes), `standings.ts` and video matching, plus
  cards, the featured match rules, dates and the sync's match mapping. `pnpm test`; CI runs lint, types and tests
  on every push (`.github/workflows/ci.yml`).
- [x] End-to-end test of the sync against recorded API responses (26 Oct 2026): `src/sync/run.test.ts` runs
  `runSync` offline in under a second (first run, incremental run, a 500 on `content`, a time budget, private
  players), from responses recorded by `pnpm test:record-sync`. Plan: [12 · End-to-end sync test](plans/12-sync-e2e-test.md).
- [ ] Accessibility review (coral on white contrast, focus, screen readers on the timeline). Plan:
  [13 · Accessibility review](plans/13-accessibility.md).
- [ ] Revalidate only what a sync changed, not the whole site. First measurement taken on 24 Oct 2026 (Turso
  reads, Vercel ISR writes and Active CPU, in the plan); measure again after a week of normal runs (~1 Nov) and
  build it if ISR writes are still high. Plan: [14 · Targeted revalidation](plans/14-targeted-revalidation.md).
- [x] Rows read on Turso, measured on 26 Oct 2026 (500M a month on the free plan; 110M used that month, 91M of
  them by the initial backfill on 22-23 Oct). A sync with nothing new reads ~3,300 rows, one with results
  5,000-22,000 (~150 per squad refreshed); `pnpm notify` ~400 whatever the number of subscriptions. Most reads
  come from development: dev sessions and preview builds against production read 1-3M rows an hour. Done: indexes
  for a player's squads and for the season's scorers, notify reading only upcoming matches, `pnpm db:pull` for a
  local copy. Still open:
  - [ ] Views compute "now" inside `"use cache"`, so they keep `revalidate: 300`; an inline `cacheLife` lasting
    until the next kickoff or midnight would let pages hold for hours outside match nights.
  - [ ] The sync's 60-minute overlap saves each changed match ~4 times on match nights and refreshes both squads
    each time (~13 s each against the API; 124 squads took 26 min, past the 15-minute budget, which that loop
    does not check). Skip squads whose matches' `modified` did not change.
  - [ ] Preview builds read production. A staging database only saves quota in another Turso organization.
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

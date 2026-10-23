# 01 · Matches of a day

## Why

The home page shows the matches of today (or of the next day with matches) as a horizontal strip. On a busy
day that is 36 cards: scrolling them sideways with a mouse is awkward and there is no way to see them all at
once, compare kick-off times or find the ones at your venue. The approved home design has a "Ver los 36 →" link
that has nowhere to go yet.

## What to build

A page with every match of one date, and the link to it from the home strip.

- **Route:** `/partidos/dia/[fecha]`, with `fecha` as `YYYY-MM-DD` (for example `/partidos/dia/2026-10-26`).
  A path segment rather than `?fecha=`: the page can be cached per date and the URL is easy to share.
  `/partidos/[id]` already exists; `dia` is a static sibling segment, which takes priority over `[id]`, but check
  the routing docs in `node_modules/next/dist/docs/` to confirm. An invalid or empty date returns `notFound()`.
- **Header:** eyebrow ("Hoy", "Mañana", "Ayer" or nothing), the long date as the title ("Lunes 26 de octubre",
  `capitalize(formatLongDate(...))`), and "36 partidos en 14 campos · Liga Apertura" (the competition only when
  every match shares it). Previous / next links jump to the previous and next **dates that have matches**, not
  to the adjacent calendar day.
- **Body:** matches grouped by kick-off time ("20:00", "20:15", …), sorted by time and then venue. Each row:
  time, venue, home and away with crest and position in their group, score when played, and the group label
  ("Grupo 7 · J4", or the competition name outside the main one). The whole row links to `/partidos/[id]`.
  The focus team's match is highlighted (`border-accent bg-accent-soft`, as in the home strip).
- **Optional, if cheap:** a "Por hora / Por campo" toggle (links that change a `?orden=campo` parameter, no client
  state) to group by venue instead. Skip it if it complicates caching.
- **Home page:** the strip heading gets a "Ver los N →" link to this page for the strip's date.
- **Match page:** the "Resto de la jornada" card could link to the day of that match. Nice to have.
- **Metadata:** title "Partidos del lunes 26 de octubre".

## How

1. **Extract the day logic.** `src/lib/views/home.ts` already builds the day: `pickDay`, the per-group standings
   cache (`positionIn`), the label and `isFocus`. Move that into `src/lib/views/day.ts`, exporting something like
   `buildDay(matches, tree, date, focusTeamId, mainCompetitionId)` and `pickDay(matches, today)`. The home view calls
   it, so the strip and the page can never disagree. Keep `DayMatch` as the row type.
2. **New view** `getDayPageData(date)` in `day.ts`: `"use cache"`, `cacheLife("results")`, reads
   `getCurrentSeason()` and `getSeasonMatches()` (a date outside the current season can return `notFound()`; past
   seasons are out of scope), computes the previous and next dates with matches, and groups rows by time.
3. **Page** `src/app/partidos/dia/[fecha]/page.tsx`, with the Suspense + skeleton pattern of the other pages.
   Reuse `Crest` and the card styling of `DayStrip` in `src/app/page.tsx`. On a phone the rows must fit 390 px:
   names truncate, the group label goes on a second line.
4. **Link** from `DayStrip` in `src/app/page.tsx`.

## Done when

- `/partidos/dia/<a busy date>` lists every match of that date grouped by time; the count matches the home strip.
- Previous / next skip days without matches; a date with no matches or a malformed one gives the 404 page.
- The home strip links to it; the focus team's match is highlighted on both.
- Lint and types pass; screenshots at 1280 and 390 px look right (no horizontal scroll on the page itself).

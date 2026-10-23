# 05 · Player search

## Why

The header search (`src/components/team-search.tsx`) only finds companies. People also look for themselves and
for teammates or rivals, and player pages (`/jugadores/[id]`) already exist.

## What exists

- `TeamSearch` is a client component. `SiteHeader` reads every team (`getTeams()`, about 325) on every page and
  passes them as props, so the list (~45 KB of JSON, with logo URLs) is serialised into every page's HTML. It filters
  in the browser: accent-insensitive (`normalize`), prefix matches first, then active teams, at most 8 results,
  keyboard navigation (`combobox` + `listbox`).
- The `players` table has 14,628 rows, and 7,613 have an empty name (private profile; the league hides the name
  everywhere). About 7,000 are searchable.

## Why not a search endpoint

Turso is on the free Starter plan with **overages disabled** (`turso plan show`): 500M rows read a month, and past
the limit Turso refuses reads and the **whole site** goes down until the 1st. A word-prefix `LIKE` over `players`
cannot use an index (`EXPLAIN QUERY PLAN` says `SCAN players`), so every request would read all 14,628 rows, about
40,000 per search with a debounce. A bot hammering `/api/buscar?q=` would empty the month's quota in ~34,000 requests.
FTS5 is available in Turso and would make it cheap, but a static index is simpler, faster and costs no rows at all.

## What to build

One search box that finds companies and players, results grouped under "Equipos" and "Jugadores", served from a
**single static index** the browser downloads the first time the search is used.

1. **The index**, built on the server from the database and cached with the site's data:
   - Teams: slug, name, logo URL, active this season.
   - Players with a name: id, name, photo URL (or none), and their current team's name (their squad this season,
     `squadPlayers`, falling back to the team of their latest match). Players without a name are left out.
   - Compact format (arrays, not objects; logo and photo URLs shortened if they share a prefix). Measured in Oct
     2026: ids, names and teams of every named player are 413 KB as JSON, 83 KB gzip, 65 KB brotli. Aim for well under
     100 KB compressed with teams included; check the real size in production's response headers.
   - A query in `src/lib/data.ts` (`"use cache"`, `cacheLife`, `cacheTag(DATA_TAG)`), so the sync's
     `POST /api/revalidate` refreshes it. One query for players, not one per player (no correlated subquery per row:
     it reads hundreds of thousands of rows).
2. **Serving it:** a route handler, e.g. `src/app/api/indice-busqueda/route.ts`. Read the route handler and Cache
   Components docs in `node_modules/next/dist/docs/` first: the goal is that it is prerendered or cached so a request
   never touches Turso, and that the CDN and the browser cache it (`Cache-Control` with `s-maxage` and
   `stale-while-revalidate`). To avoid a browser holding an old index for long, version the URL with something that
   changes when the data does (e.g. the last sync stamp) or keep the browser `max-age` short.
3. **The header:** `SiteHeader` stops reading teams (it still reads the season). Rename `TeamSearch` to
   `SiteSearch`; it no longer takes props.
4. **Loading:** start the download on the first `pointerenter`/`focus` of the search box (and optionally when the
   browser is idle after load), once per page session, shared across navigations (a module-level promise). Until it
   arrives, typing shows a quiet "Buscando…" and the results appear as soon as it lands. If it fails, show
   "No se pudo cargar la búsqueda" and retry on the next focus.
5. **Matching:** normalise every name once when the index loads (the same `normalize` as today), not on every
   keystroke. Match at the start of any word ("lertx" finds "Telmo Lertxundi"); teams also keep today's "contains".
   Order: prefix of the whole name first, then word prefix; teams active this season before old ones. At most 5 teams
   and 6 players; show a group only if it has results.
6. **Results:** teams as today (crest, name) linking to `/equipos/[slug]`; players with `PlayerAvatar` (photo, or
   initials), name and current team, linking to `/jugadores/[id]`. One `listbox` with both groups, arrows moving
   across them, Enter to open, Escape to close. Placeholder "Busca empresa o jugador", and the hidden label too.
7. **Pages kept hidden:** the search lives in the root layout, so it is not affected by `<Activity>`, but do not
   leave timers running after a navigation.

## Done when

- Typing "lertx" shows Telmo Lertxundi (Mutua Madrileña); "ruben" finds "Rubén"; "embat" still finds the team.
- Players without a name never show up.
- No Turso query runs per search: with the dev server's logs, typing several queries reads nothing from the database
  after the index is loaded.
- Pages' HTML no longer carries the team list (compare a page's size before and after).
- Works with the keyboard and at 390 px; lint, types and tests pass (unit tests for the matching and ordering).

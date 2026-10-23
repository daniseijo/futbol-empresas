# 05 · Player search

## Why

The header search (`src/components/team-search.tsx`) only finds companies. People also look for themselves and
for teammates or rivals, and player pages (`/jugadores/[id]`) already exist.

## What exists

- `TeamSearch` is a client component. The server passes it the whole team list (about 325 teams) and it filters
  in the browser: accent-insensitive (`normalize`), prefix matches first, then active teams, at most 8 results,
  keyboard navigation (`combobox` + `listbox`).
- The `players` table has **14,627 rows, and 7,613 have an empty name**: players with a private profile, whose name
  the league hides everywhere. Only about 7,000 are searchable. Sending them all to the browser on every page is too
  heavy, so player search has to run on the server.

## What to build

One search box that finds companies and players, results grouped under "Equipos" and "Jugadores".

## How

1. **Server search:** a route handler `src/app/api/buscar/route.ts`, `GET ?q=` (minimum 2 characters), returning
   `{ players: [{ id, name, team, photoUrl }] }`, at most 6 players. Teams stay client-side as today (instant,
   already loaded); only players hit the server.
2. **Accent-insensitive matching in SQLite:** `lower()` does not fold accents, and players are named "Rubén",
   "Íñigo"… Add a `name_search` column to `players` (lower case, accents removed, the same `normalize` as the
   client) through a Drizzle migration (`pnpm db:generate`), fill it in the sync where players are written
   (`src/sync/`), and backfill existing rows in the migration with an `UPDATE` (or a one-off script; SQLite has no
   built-in unaccent, so the backfill may need to be done in TypeScript). Index it. Query with
   `name_search LIKE 'q%' OR name_search LIKE '% q%'` (word prefix), ordering prefix matches first. Skip empty names.
3. **Team per player:** show the player's current team (their squad in the current season; `squadPlayers` in
   `src/db/schema.ts`), falling back to their latest match's team.
4. **Caching:** the handler reads Turso; keep it cheap (indexed, `LIMIT`). Check in the Next docs how route
   handlers are cached under Cache Components; a short `Cache-Control` on the response is enough.
5. **Client:** in `TeamSearch` (rename it `SiteSearch`), debounce the fetch (~200 ms), abort stale requests, keep
   keyboard navigation across both groups, and show a quiet "Buscando…" state. Update its placeholder to
   "Busca empresa o jugador". Player results go to `/jugadores/[id]`.
6. **Production migration:** `pnpm sync` applies pending Drizzle migrations from `drizzle/` when it starts
   (`migrate()` in `src/sync/run.ts`), so the next scheduled sync after merging will migrate Turso. That means the
   site code must cope with the column being empty until then (fall back to no player results, not an error), and
   the backfill must run inside the migration or the sync, not by hand. Never change the production schema manually.

## Done when

- Typing "lertx" shows Telmo Lertxundi (Mutua Madrileña); "ruben" finds "Rubén"; teams still appear instantly.
- Players without a name never show up.
- Works with the keyboard and at 390 px.
- The migration runs on a copy of the database and on Turso through the documented path; lint and types pass.

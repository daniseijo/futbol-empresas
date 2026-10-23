# Futbolempresas

Unofficial website for the Madrid company 7-a-side football league, built on top of the public API of
[futbolempresas.es](https://www.futbolempresas.es) (WordPress + SportsPress v2). It focuses on one team
(Embat by default), but any team can be browsed. The site itself is in Spanish.

## How it works

```
League API ──pnpm sync──▶ own database (SQLite / Turso) ──▶ Next.js pages
  (slow)    (GitHub Actions)                                (read the DB only)
```

The league API is slow (0.2 to 12 s per call) and chokes on parallel requests. That is why the site
**never calls it while rendering**: a sync copies the data into our own database and the pages read from it
in milliseconds.

## Running locally

```bash
pnpm install
pnpm sync    # downloads the data into data/futbol.db (takes hours the first time; resumable)
pnpm dev     # http://localhost:3000
```

The sync is **progressive and resumable**: it works by priority (current season, focus team and its group,
squads, videos, past seasons) and saves its progress after every page or team. It can be stopped with Ctrl+C
and restarted at any time; each run also pulls whatever changed since the previous one first.

```bash
pnpm sync                         # resumes where it stopped
pnpm sync -- --budget=600         # stops after 10 minutes (GitHub Actions uses it)
pnpm sync -- --matches=104101     # downloads specific matches again
pnpm sync:reset                   # downloads everything again from scratch
```

Environment variables: see `.env.example`. Without `DATABASE_URL` the local file `data/futbol.db` is used.

## Copying the database to another machine

`data/futbol.db` **is not committed**: it is a copy of third-party data (with player names and photos), it can
be rebuilt with `pnpm sync`, and it changes all the time. To move it to another machine without waiting for a
sync:

```bash
# With the sync and the site stopped, make a consistent single-file copy
# (locally the database runs in WAL mode, so copying futbol.db alone is not enough).
sqlite3 data/futbol.db ".backup futbol-copy.db"
```

Move `futbol-copy.db` over (AirDrop, Drive...), save it as `data/futbol.db` on the other machine and run
`pnpm sync`: it carries on where it stopped, because the backfill state lives inside the database itself.

## Deploying (Vercel + Turso + GitHub Actions)

1. **Turso database, with the backfill already done locally:** make a consistent copy
   (`sqlite3 data/futbol.db ".backup futbolempresas.db"`), switch it to WAL mode with the log checkpointed
   (`sqlite3 futbolempresas.db "PRAGMA journal_mode=wal; PRAGMA wal_checkpoint(truncate);"`) and import it with
   `turso db import futbolempresas.db` (the database takes the file's name). Then create a token with
   `turso db tokens create futbolempresas` and get the URL with `turso db show futbolempresas --url`.
2. **Without a local backfill:** `turso db create futbolempresas` creates an empty one; the GitHub action fills
   it over time, but that takes days.
3. **Vercel:** import the repository and set `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `REVALIDATE_SECRET`
   and, for another focus team, `NEXT_PUBLIC_FOCUS_TEAM_SLUG`. Also set `ENABLE_EXPERIMENTAL_COREPACK=1` so
   Vercel uses the pnpm version pinned in `packageManager`. `vercel.json` runs the functions in Dublin
   (`dub1`), next to the Turso database.
4. **GitHub:** under *Settings › Secrets and variables › Actions*, create the secrets `DATABASE_URL`,
   `DATABASE_AUTH_TOKEN`, `REVALIDATE_SECRET` (same as in Vercel) and `REVALIDATE_URL`
   (`https://<domain>/api/revalidate`), and the variable `SYNC_ENABLED=true`. Without that variable the
   scheduled action does not run (so it does not load the API while there is no remote database).

The `.github/workflows/sync.yml` action syncs every 3 hours, and an external cron starts it every 20 minutes on
match nights (Monday to Friday, see below). Each run takes 15 minutes at most, then calls `/api/revalidate` so
the site refreshes its cache.

The league server is slow (a squad's `/lists` call takes ~10 s, a match page for its video ~3 s, two at a time),
so a big backfill such as the video archive takes many runs. To finish it in one go, start a longer manual run:
`gh workflow run sync.yml -f budget_minutes=120` (up to 330). Scheduled runs queue behind it, and the site only
refreshes when it ends, so avoid match nights.

### Keeping an eye on the sync

- **Failures** open an issue labelled `sync-failure` (GitHub notifies the owner). Later failures comment on it,
  and the next successful run closes it. Running out of the 15-minute budget is not a failure.
- **Stale data** shows on the site: the footer's "Datos actualizados…" turns red after 12 hours without a sync.
- **The 60-day shutdown:** GitHub disables schedules in public repositories after 60 days without commits, and
  the sync never commits. `.github/workflows/keepalive.yml` re-enables both workflows on the 1st of every
  month. If a schedule was disabled anyway: `gh workflow enable sync.yml`.
- **Late or missing scheduled runs:** GitHub's `schedule` is best effort. On busy hours it starts runs hours
  late or drops them (on 22–23 Oct 2026 the 09:07 UTC run started at 11:27, and a match night got 5 of its
  ~21 runs). So match nights are not on GitHub's schedule: an external cron triggers the workflow instead
(set up on 23 Oct 2026 in cron-job.org). To set it up again:
  1. Create a fine-grained token at *GitHub › Settings › Developer settings › Fine-grained tokens*, for this
     repository only, with **Actions: Read and write** and nothing else. It expires: note the date.
  2. In an external cron service (e.g. cron-job.org, free), add a job in the `Europe/Madrid` time zone, every
     20 minutes from 19:00 to 23:59, Monday to Friday, that sends:

     ```
     POST https://api.github.com/repos/<owner>/<repo>/actions/workflows/sync.yml/dispatches
     Authorization: Bearer <token>
     Accept: application/vnd.github+json
     Content-Type: application/json

     {"ref":"main"}
     ```

     GitHub answers `204`. Runs never overlap (`concurrency: sync`); if one is already waiting, GitHub
     cancels it in favour of the newer one, which is harmless.

## Pages

- `/`: home page with the day's matches, the focus team block, the season's competitions, each group's leader,
  the top scorers and the week's biggest wins.
- `/equipos/[slug]`: team, with tabs that are routes of their own: overview, `partidos` (upcoming and played),
  `clasificacion`, `plantilla` (by position or by market value) and `historial` (past seasons).
- `/competiciones/[...path]`: competition, phase or group (`/competiciones/liga-apertura/fase-1/grupo-20`), with
  the path built from the names. Shows its groups with their leader, the standings, the rounds (`?jornada=`), the
  top scorers and the Crack award. Past seasons are requested with `?temporada=25-26`.
- `/jugadores/[id]`: player, with totals, matches (goals with minute, assists, MVP) and teams per season, taken
  from the match sheets. Players with a private profile are shown by their shirt number.
- `/partidos/[id]`: match page with score, goal timeline, video highlights, MVP, lineups, stats, head to head,
  the rest of the round and the venue; or the preview if it has not been played yet.

## Structure

```
src/
  config/site.ts         focus team, API URL, time zone
  db/                    Drizzle schema (SQLite) and libSQL client
  sync/                  API → database sync (fetch.ts downloads, run.ts stores)
  lib/data.ts            database reads for the pages ("use cache")
  lib/views/             precomputed data for each page
  lib/sportspress/       API client, parsers and domain types
  lib/standings.ts       standings computed from the matches
  app/api/revalidate     endpoint the sync calls when it finishes
  test/fixtures.ts       builders for test data (tests live next to the code as *.test.ts)
scripts/sync.ts          `pnpm sync` (see the options above)
drizzle/                 migrations (generated with `pnpm db:generate`)
```

## Things worth knowing about the API

- **`/players` is the slowest endpoint** (10 s or more), because it computes every player's stats. Squads come
  from the team's lists (`/lists`): the "Plantilla" list gives the stats, the per-position lists give the
  position, and photos are fetched with `media?parent=`. `_embed` is very slow too.
- **Incremental sync:** `modified_after` returns only what changed since the last run (Madrid local time;
  requested with one hour of overlap).
- **Group standings are reused every season.** The site computes them from the matches (3 points for a win,
  1 for a draw), which also works for past seasons.
- **A match with a score counts as played**, even if its `status` is `future` (administrative results).
- **Private players:** the API answers 404 and they are missing from the public pages too; only their id and
  shirt number remain on the match sheet.
- **Match videos** are not in the API: they are scraped from each match's web page.
- **Some matches break WordPress** when rendering their `content` (persistent 500); the sync fetches those
  pages without it and isolates the broken match.
- **Team photos:** they are banners in the team content. `*-CABECERA.jpg` files are the silhouette template and
  are ignored; the latest match photo (from Flickr) is used instead.
- **Player photos:** the generic avatar is not attached to any player. Without a photo, the shirt number is
  shown on the position's colour and, without a number, the initials.
- **Search:** `teams?search=…` needs `search_columns=post_title`, or it also searches inside the HTML.

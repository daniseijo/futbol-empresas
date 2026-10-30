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
pnpm db:pull # copies the production database into data/futbol.db (needs the Turso CLI, logged in, and sqlite3)
pnpm dev     # http://localhost:3000
```

`pnpm db:pull` takes a few seconds and reads every row of the Turso database once (~200,000 rows read). Run it
again whenever you want fresh data, with `pnpm dev` stopped. Develop against this copy rather than Turso: a dev
session against production reads 1-3M rows an hour, and rows read are the limit of the free plan. Without the
Turso CLI, `pnpm sync` builds the database from the API instead (hours the first time; resumable).

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

### Testing the sync

`pnpm test` also runs the whole sync end to end, offline (`src/sync/run.test.ts`, under a second): `runSync`
against a throwaway database, with `fetch` answering from API responses recorded in `src/test/fixtures/sync/`
(one season, three teams, a dozen matches; see `SLICE` in `src/test/sync-fixtures.ts`). A request without a
recording fails the test, so a new call in the sync shows up in CI. When the API or the sync's requests change,
re-record them by hand and commit the result:

```bash
pnpm test:record-sync    # ~2 minutes against the league API; never touches DATABASE_URL
```

The recorder narrows requests that would download the whole league to the slice, trims each response to what
the sync reads (~0.5 MB in total) and answers 500 to the `content` of one match, as WordPress does with some.
When a new season starts, pick new ids for `SLICE` and update the ids at the top of the test.

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
   (`dub1`), next to the Turso database, and skips deployments of pushes that only change docs, Markdown,
   workflows or agent config (`scripts/vercel-ignore-build.sh`).
4. **GitHub:** under *Settings › Secrets and variables › Actions*, create the secrets `DATABASE_URL`,
   `DATABASE_AUTH_TOKEN`, `REVALIDATE_SECRET` (same as in Vercel) and `REVALIDATE_URL`
   (`https://<domain>/api/revalidate`), and the variable `SYNC_ENABLED=true`. Without that variable the
   scheduled action does not run (so it does not load the API while there is no remote database).

The `.github/workflows/sync.yml` action syncs every 3 hours, and an external cron starts it every 20 minutes on
match nights (Monday to Friday, see below). Each run takes 15 minutes at most, then calls `/api/revalidate` so
the site refreshes its cache.

The league server is slow (a squad's `/lists` call takes ~10 s, an old match page for its video ~13 s), but it
keeps a page's time nearly flat with several at once, so the client fetches up to 6 website pages at a time
(`PAGE_CONCURRENCY` in `src/lib/sportspress/client.ts`) and keeps the API at 2. Even so, a big backfill
such as the video archive (~800 matches an hour) takes many runs. To finish it sooner, start a longer manual
run: `gh workflow run sync.yml -f budget_minutes=120` (up to 330). Scheduled runs queue behind it, and the site
only refreshes when it ends, so avoid match nights. On Saturday and Sunday at 07:00 UTC a scheduled run gets 330
minutes on its own; once nothing is pending it ends in a few minutes.

### Keeping an eye on the sync

- **Failures** open an issue labelled `sync-failure` (GitHub notifies the owner). Later failures comment on it,
  and the next successful run closes it. Running out of the 15-minute budget is not a failure.
- **Stale data** shows on the site: the footer's "Datos actualizados…" turns red after 12 hours without a sync.
- **The 60-day shutdown:** GitHub disables schedules in public repositories after 60 days without commits, and
  the sync never commits. `.github/workflows/keepalive.yml` re-enables both workflows on the 1st of every
  month. If a schedule was disabled anyway: `gh workflow enable sync.yml`.
- **Late or missing scheduled runs:** GitHub's `schedule` is best effort. On busy hours it starts runs hours
  late or drops them (on 22–23 Oct 2026 the 09:07 UTC run started at 11:27, and a match night got 5 of its
  ~21 runs). So match nights are not on GitHub's schedule: a [cron-job.org](https://cron-job.org) job calls the
  `workflow_dispatch` API every 20 minutes on match nights, from 20:30 (when the first matches end) to 01:50
  (the league uploads results until about 01:00), Monday to Friday nights. GitHub answers `204`.
  Runs never overlap (`concurrency: sync`); if one is already waiting, GitHub cancels it in favour of the newer
  one, which is harmless.

### The cron-job.org jobs

The jobs start GitHub workflows: **sync** every 20 minutes all day from Tuesday to Friday and on Monday night
(`sync.yml`, two jobs, since a job runs every hour × minute it lists on the weekdays of the run: matches are Monday
to Thursday nights, and the league uploads some results that night and the rest the morning after, with the
reports around lunchtime), and **notify** on the hour from 07:00 to 22:00, Monday to Friday (`notify.yml`, the Slack call-ups each channel
schedules). They are defined in
`scripts/cron-job.ts` and managed through cron-job.org's API, with `CRONJOB_API_KEY` in `.env.local`
(cron-job.org › Settings › API; 100 calls a day on the free plan):

```sh
pnpm cron-job          # each job, its last runs (with GitHub's error message if any) and the next ones
pnpm cron-job diff     # what apply would change
pnpm cron-job apply    # make the jobs match scripts/cron-job.ts, creating the missing ones
```

They call GitHub with a fine-grained token (*GitHub › Settings › Developer settings › Fine-grained tokens*):
this repository only, **Actions: Read and write** and nothing else. The token lives only in the jobs: `apply`
keeps it (a new job takes it from the others), and the script never prints it. To set a new one (it expired, or the job is created from scratch):
`GITHUB_DISPATCH_TOKEN=github_pat_… pnpm cron-job apply`. cron-job.org emails the owner when a call fails, for
example with `401` once the token expires.

### Match call-ups (Telegram, Slack)

`pnpm notify` announces the focus team's upcoming matches: when, where, against whom and a link to the match
page, plus a "¿Vas?" poll on Telegram (Slack asks for ✅/❌ reactions instead). It runs as its own job after every
sync in `sync.yml`, reads only the database and records what it sent in `notifications`, one row per match and
channel. So a match is announced once per channel, again as "Cambio de horario" if its date or venue changes, and
only from `NOTIFY_DAYS` (14) before it, so a batch of new fixtures does not arrive all at once. A channel added
later starts with the matches inside that window.

A channel is on when its GitHub secrets exist (*Settings › Secrets and variables › Actions*):

- **Telegram:** `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Create the bot with
  [@BotFather](https://t.me/BotFather) (`/newbot`), add it to the group, send a message there and read the
  group's `chat.id` (negative, `-100…` for supergroups) from `https://api.telegram.org/bot<token>/getUpdates`.
- **Slack:** `SLACK_WEBHOOK_URL`. Create an app at [api.slack.com/apps](https://api.slack.com/apps) (*From
  scratch*), turn on *Incoming Webhooks*, *Add New Webhook to Workspace* and pick the channel.

To try it from a laptop, without sending what the job would send (nothing is recorded in either case):

```sh
pnpm notify -- --dry-run                                         # what the job would send now
TELEGRAM_BOT_TOKEN=… TELEGRAM_CHAT_ID=… pnpm notify -- --match=104101   # send that match's call-up
```

`--dry-run` and `--match` work with a read-only database token. Without a channel set, `pnpm notify` only prints.
`--match` also sends to the Slack subscriptions of either team in that match (it needs `NOTIFY_ENCRYPTION_KEY`);
`--to=sub:3` (or `telegram`, `slack`) sends it to that channel alone. Without the key on the laptop, run the Notify
workflow by hand on GitHub with the `match` and `to` inputs: it has the secrets.

#### Slack subscriptions to any team

Every team page has a "Recibir convocatorias en Slack" button, so anyone can get any team's call-ups in a Slack
channel, with no accounts:

1. The button opens `/slack/nuevo?equipo=<slug>`, where the visitor picks **when** the call-ups come: a weekday
   (Monday to Friday) and a whole hour from 07:00 to 22:00, by default Thursday at 10:00. Each match is announced
   on the last such weekday **before** it (`src/notify/schedule.ts`): a Tuesday match on the Thursday before, a
   Friday one the day before. Never on a weekend. A change of time or venue to an announced match goes out at once.
2. The form goes to `/api/slack/instalar`, which starts Slack's OAuth v2 with only the `incoming-webhook` scope.
   The team, the schedule and a nonce travel in `state`, signed with the client secret; the nonce is also kept in
   a cookie, so the callback only accepts the browser that started the flow, within 10 minutes.
3. Slack's consent screen picks the workspace and the channel and sends the visitor back to
   `/api/slack/autorizado`, which trades the code for the channel's webhook, stores it in `subscriptions`
   **encrypted** (AES-256-GCM, `src/notify/secrets.ts`) with the schedule, says hello in the channel and shows
   `/slack`. The same channel and team again only replaces the webhook and the schedule.
4. `pnpm notify` loads every subscription, the upcoming matches of all the followed teams in one query, and sends
   each one its team's call-ups when they are due. Each target keeps its own record in `notifications`: `telegram`
   and `slack` for the env-configured channels (which keep the 14-day rule), `sub:<id>` for the subscriptions. One
   target failing never stops the others. It runs after every sync and, so messages arrive on time, every hour
   through `notify.yml` (see "The cron-job.org jobs"); both share a concurrency group, so nothing goes twice.
5. Every call-up ends with "🔔 Convocatorias F7 avisa el jueves antes de cada partido, a las 10:00 · Cambiar avisos
   o darse de baja". The link is `/slack/avisos?s=<id>.<signature>` (HMAC with `NOTIFY_ENCRYPTION_KEY`): a page
   to change the schedule or unsubscribe, with no accounts, through Server Actions that check the signature.
   Removing the app from Slack works too: the webhook then answers `no_service`, `channel_not_found`… and
   `pnpm notify` deletes the subscription.

Those routes and actions are the site's only writes to the database. Vercel's `DATABASE_AUTH_TOKEN` stays
read-only; they use `DATABASE_WRITE_AUTH_TOKEN` (`turso db tokens create futbolempresas`), which nothing else gets. The table
itself is created by the migrations that `pnpm sync` and `pnpm notify` apply.

Setup:

1. At [api.slack.com/apps](https://api.slack.com/apps), *Create New App › From scratch*, then *Incoming Webhooks*:
   on.
2. *OAuth & Permissions › Redirect URLs*: add `https://<site>/api/slack/autorizado` for each address it runs on
   (production and, to try it, a preview's branch alias). Slack only accepts HTTPS, so it cannot be tried on
   `localhost` without a tunnel. Under *Scopes › Bot Token Scopes*, add `incoming-webhook`.
3. *Manage Distribution*: tick the checklist and *Activate Public Distribution*, so other workspaces can add it.
4. On Vercel: `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` (*Basic Information › App Credentials*),
   `NOTIFY_ENCRYPTION_KEY` (`openssl rand -base64 32`) and `DATABASE_WRITE_AUTH_TOKEN`. In GitHub, the same
   `NOTIFY_ENCRYPTION_KEY`. The button only shows when the Slack app is set.
5. `pnpm cron-job apply`, which creates the hourly notify job.

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
  notify/                call-ups for the focus team's matches on Telegram and Slack
  lib/data.ts            database reads for the pages ("use cache")
  lib/views/             precomputed data for each page
  lib/sportspress/       API client, parsers and domain types
  lib/standings.ts       standings computed from the matches
  app/api/revalidate     endpoint the sync calls when it finishes
  test/fixtures.ts       builders for test data (tests live next to the code as *.test.ts)
  test/fixtures/sync/    recorded API responses for the sync test (`pnpm test:record-sync`)
scripts/sync.ts          `pnpm sync` (see the options above)
scripts/record-sync.ts   `pnpm test:record-sync` (see "Testing the sync")
scripts/notify.ts        `pnpm notify` (see "Match call-ups")
drizzle/                 migrations (generated with `pnpm db:generate`)
```

## Things worth knowing about the API

- **`/players` is the slowest endpoint** (10 s or more), because it computes every player's stats. Squads come
  from the team's lists (`/lists`): the "Plantilla" list gives the stats, the per-position lists give the
  position, and photos are fetched with `media?parent=`. `_embed` is very slow too.
- **Incremental sync:** `modified_after` returns only what changed since the last run (Madrid local time;
  requested with one hour of overlap). Matches the overlap brings back with the same `modified` are skipped, so
  only a real change rewrites a match and refreshes both teams' squads.
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

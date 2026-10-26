<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Futbolempresas

An unofficial, modern website for Futbolempresas, a 7-a-side football league between Madrid companies
(futbolempresas.es). It is centred on one **focus team** (Embat by default) but every page works for any team and
for past seasons. Production: https://futbol-empresas.vercel.app (Vercel deploys `main`
automatically).

Stack: Next.js 16 (App Router, Cache Components, Partial Prefetching), React 19, TypeScript, Tailwind 4, Drizzle on
libSQL (Turso in production, `data/futbol.db` locally), pnpm, Node 24.

## How it fits together

```
futbolempresas.es (WordPress + SportsPress API)
  └─ pnpm sync (src/sync/, GitHub Actions every 3 h, every 20 min on match nights via cron-job.org)
       └─ Turso database ──► POST /api/revalidate (refreshes the site's cache)
            └─ src/lib/data.ts        cached queries ("use cache", cacheLife, cacheTag(DATA_TAG))
                 └─ src/lib/views/*.ts  one function per page that composes the data
                      └─ src/app/**/page.tsx  rendering only, streamed inside <Suspense> with a skeleton
```

- `src/config/site.ts`: site settings, including `focusTeamSlug` (env `NEXT_PUBLIC_FOCUS_TEAM_SLUG`).
- `src/lib/sportspress/`: the domain types (`types.ts`), parsing of the API's quirks (`parse.ts`), the league tree
  (`leagues.ts`) and the venues, a static list (`venues.ts`).
- `src/lib/views/featured.ts`: a team's featured match, shared by the home page and the team page. The rules
  behind it (`PREVIEW_DAYS`, `featuredMode`, the "Sube a 7º" and "A 1 punto de…" texts) are pure, in
  `featured-rules.ts`.
- `src/components/`: shared UI (`Crest`, `FormBadges`, `PlayerAvatar`, `PlayerEvents`/`CardIcon`,
  `FeaturedHero`/`FeaturedFooter`, `team/SectionCard`, `team/StandingsZone`, `team/MatchRow`…). Reuse before writing
  new ones.
- `drizzle/`: migrations. `pnpm sync` applies pending ones when it starts.
- `docs/plan.md`: the to-do list and the API's known oddities. `docs/plans/`: tasks written up for an agent to pick up.
- `README.md`: setup, deployment and how the sync works, in more detail.

## Rules

- **Read the Next.js docs in `node_modules/next/dist/docs/` before writing Next code** (see the block above).
  Caching, metadata files, route handlers and `PageProps` typing differ from older versions.
- **Never call the league API while rendering.** It takes 0.2–12 s per call and fails under load. The site only
  reads the database; anything new it needs from the API goes into the sync first.
- **Do not hard-code Embat** or any team: use `siteConfig.focusTeamSlug` and the team context.
- **Languages:** only what the site's readers see is in Spanish (Spain): the pages' text, URLs and metadata.
  Everything else is in English: code, comments, docs, plans, commit messages, PRs, and whatever the automation
  writes (workflow logs, GitHub issues, labels and comments).
- **Dates** are Madrid local time strings, `"YYYY-MM-DDTHH:mm"`. Use the helpers in `src/lib/dates.ts`
  (`nowInMadrid`, `dayKey`, `daysBetween`, `relativeDay`, `formatShortDate`, `formatLongDate`, `addDays`), never
  `Date` arithmetic on them.
- **A match with a score is played**, whatever its API status says. Standings are always computed from matches
  (`computeStandings`), never read from the API.
- **Cards:** the API only counts a player's yellow and red cards per match. Read them through `cardsFor` /
  `sendingOff` in `src/lib/cards.ts` (2 yellows = second yellow; 1 yellow + 1 red = booking then straight red) and
  draw them with `CardIcon`, in `card-yellow` / `card-red`, never in the coral accent.
- **Design:** tokens live in `src/app/globals.css` (`canvas`, `surface`, `line`, `line-soft`, `ink`, `muted`,
  `accent` coral, `accent-text`, `accent-soft`, `loss`, `card-yellow`, `card-red`); Inter for text, Barlow Condensed
  (`font-display`, uppercase, extra bold) for headings and numbers. Use tokens, not raw colours. Every page must work
  at 390 px wide without horizontal scroll, and with or without crests and player photos.
- **Pages are hidden, not unmounted, on navigation.** With Cache Components, Next.js keeps up to 3 previous routes
  in React `<Activity>` (`display: none`, state and DOM kept). Anything that keeps running while hidden (a YouTube
  iframe, timers, audio, page-level styles) must stop in a `useLayoutEffect` cleanup, as `VideoEmbed` does. See
  `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`.
- **Players with a private profile have no name** (about half of the `players` table). Never show an empty name,
  and never try to fetch it: the league hides it everywhere.

## Commands

```sh
pnpm install
pnpm dev                                   # http://localhost:3000
pnpm lint
pnpm test                                  # unit tests (node:test + tsx), next to the code as *.test.ts
npx next typegen && npx tsc --noEmit       # tsc needs the generated route types first
pnpm db:generate                           # after changing src/db/schema.ts
pnpm db:pull                               # copy the production database into data/futbol.db
node scripts/screenshot.mjs <url> <out.png> [width] [height]   # e.g. 1280 2000, or 390 1800 for a phone
pnpm cron-job [diff|apply]                 # the match-night cron on cron-job.org: status, diff, apply
```

## Checking your work

- Run lint, types and `pnpm test` (CI runs the same on every push), then look at the pages you touched at
  **1280 px and 390 px** with `scripts/screenshot.mjs`. Headless Chrome's `--window-size` cannot go below
  ~500 px, so use the script for the phone width.
- **Data:** without `DATABASE_URL` in `.env.local` the site reads `data/futbol.db`. Refresh it from production
  with `pnpm db:pull` (a few seconds; stop `pnpm dev` first). Prefer that to pointing `.env.local` at Turso: a dev
  session against production reads 1-3M rows an hour, and rows read are the plan's tightest limit. If you must,
  use a **read-only** token (`turso db tokens create futbolempresas --read-only`). Never run `pnpm sync` against
  production from a laptop.
- **Restart `pnpm dev`** after changing `.env.local` or adding tokens to `globals.css`: it can keep serving stale CSS.
- To try another focus team: `NEXT_PUBLIC_FOCUS_TEAM_SLUG=telefonica-femenino pnpm dev`.

## Git

- Branch off `main`; do not commit or push to `main` unless the owner asks (it deploys to production).
- Conventional Commits (`feat(home): …`, `fix(matches): …`, `perf(sync): …`), imperative subject, a body that
  explains why. Small commits that each compile on their own.
- `next dev` rewrites the block at the top of this file. If it shows up as changed, commit it with your work.
- Tick or update `docs/plan.md` when you finish something on it.

# Implementation plans

Each file here is a self-contained task that an agent can pick up without the conversation that produced it.
Read this page first: it holds what every plan assumes. The overall checklist lives in [`../plan.md`](../plan.md);
tick its box when a plan ships.

| Plan | What it delivers | Size |
| --- | --- | --- |
| [01 · Matches of a day](01-day-matches-page.md) | A page with every match of a date, linked from the home strip | M |
| [02 · Unit tests](02-unit-tests.md) | A test runner and tests for the logic that decides what users see | M |
| [03 · Sync monitoring](03-sync-monitoring.md) | Confirm the scheduled sync runs, and get alerted when it fails | S |
| [04 · Venue page](04-venue-page.md) | `/campos/[id]` with map, address and matches, linked everywhere a venue appears | M |
| [05 · Player search](05-player-search.md) | The header search finds players as well as companies | M |
| [06 · Sharing and SEO](06-share-and-seo.md) | Share button, Open Graph images for matches and teams, sitemap | M |
| [07 · Women's league](07-womens-league.md) | Check and fix the home page and team pages for the women's competitions | S |

01 and 02 are the most valuable next. 03 is quick and protects everything else. The rest are independent of each
other and can run in parallel, but 01 and 04 both touch the home page's match strip: merge one before starting the
other.

## The project in one paragraph

An unofficial, modern website for Futbolempresas, a 7-a-side football league between Madrid companies
(futbolempresas.es). Next.js 16 (App Router, Cache Components, Partial Prefetching), React 19, Tailwind 4,
Drizzle on libSQL. A GitHub Action (`.github/workflows/sync.yml`, `pnpm sync`) copies the league's WordPress
SportsPress API into a Turso database; the site only ever reads that database. It is centred on one "focus team"
(Embat by default) but works for any team.

## Rules every plan follows

- **Next.js 16 is not the Next.js in your training data.** Read the relevant guide in `node_modules/next/dist/docs/`
  before writing code (see `AGENTS.md`). Metadata files, caching (`"use cache"`, `cacheLife`, `cacheTag`) and
  `PageProps` typing are the usual traps.
- **Never call the league API while rendering.** It is slow (0.2–12 s per call) and fails under load. Pages read
  the database through `src/lib/data.ts`; anything new the site needs from the API goes into the sync
  (`src/sync/`) first.
- **Do not hard-code Embat.** The focus team is `siteConfig.focusTeamSlug` (`src/config/site.ts`), overridable with
  `NEXT_PUBLIC_FOCUS_TEAM_SLUG`.
- **Languages:** visible text and URLs in Spanish (Spain); code, comments, docs and commit messages in English.
- **Data layer:** `src/lib/data.ts` (cached queries, `cacheLife("results")` for match data, `"catalog"` for slow
  changing lists, `cacheTag(DATA_TAG)` so the sync can revalidate) → `src/lib/views/*.ts` (one function per page
  that composes the data) → `src/app/**/page.tsx` (rendering only). Pages stream: an async component inside
  `<Suspense>` with a skeleton fallback (see `src/app/page.tsx` and `src/app/equipos/[slug]/team-page.tsx`).
- **Dates** are Madrid local time strings, `"YYYY-MM-DDTHH:mm"`. Use the helpers in `src/lib/dates.ts`
  (`nowInMadrid`, `dayKey`, `daysBetween`, `relativeDay`, `formatShortDate`, `formatLongDate`, `addDays`), never
  `new Date()` arithmetic on them.
- **A match with a score counts as played**, whatever its API status says.
- **Design:** tokens in `src/app/globals.css` (`canvas`, `surface`, `line`, `line-soft`, `ink`, `muted`, `accent`
  coral, `accent-text`, `accent-soft`, `loss`, `card-yellow`, `card-red`); Inter for text, Barlow Condensed
  (`font-display`, uppercase, extra bold) for headings and numbers. Reuse the components before writing new ones:
  `Crest`, `FormBadges`/`OutcomeBadge`, `PlayerAvatar`, `PlayerEvents`/`CardIcon`, `SectionCard`, `StandingsZone`,
  `MatchRow`, `FeaturedHero`/`FeaturedFooter`, `Eyebrow`. Every page must work at 390 px wide with no horizontal
  scroll. Team crests and player photos may be missing: everything must look right without them.

## Running and checking your work

```sh
pnpm install
pnpm dev                      # http://localhost:3000
pnpm lint
npx next typegen && npx tsc --noEmit
node scripts/screenshot.mjs http://localhost:3000/ /tmp/home.png 1280 2000   # desktop
node scripts/screenshot.mjs http://localhost:3000/ /tmp/home-phone.png 390 1800  # phone
```

- **Database:** without a `.env.local` the site reads `data/futbol.db`, a local copy that can be days old. To see
  production data, put `DATABASE_URL` and a **read-only** `DATABASE_AUTH_TOKEN` in `.env.local`
  (`turso db tokens create futbolempresas --read-only`). Never run `pnpm sync` against production from your machine.
- **Restart `pnpm dev`** after changing `.env.local` or adding theme tokens to `globals.css`: the dev server can keep
  serving stale CSS.
- `npx tsc` reports errors about `AppRoutes` and `PageProps` until `npx next typegen` has generated the route types.
- Look at the screenshots, at both widths, before saying a page is done.

## Delivering

- Work on a branch, never on `main`. Small commits in Conventional Commits style (`feat(home): …`,
  `fix(matches): …`), each one compiling on its own, ending with the co-author trailer the repository uses.
- Update `docs/plan.md` (tick the box, or add what you found that is still pending).
- Report what you could not verify.

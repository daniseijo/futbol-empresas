# Implementation plans

Each file here is a self-contained task that an agent can pick up without the conversation that produced it.
Every plan assumes the project guide in [`AGENTS.md`](../../AGENTS.md). The overall checklist lives in
[`../plan.md`](../plan.md); tick its box when a plan ships.

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

## Before starting a plan

Read [`AGENTS.md`](../../AGENTS.md) at the repository root: the architecture, the rules every change follows, how to
run and check the site (including screenshots at 1280 and 390 px and using production data read-only), and how to
deliver (a branch, small Conventional Commits, `docs/plan.md` updated). The plans assume all of it.

When you finish, report what you could not verify.

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
| [05 · Player search](05-player-search.md) | The header search finds players as well as companies, from one static index | M |
| [06 · Sharing and SEO](06-share-and-seo.md) | Share button, Open Graph images for matches and teams, sitemap | M |
| [07 · Women's league](07-womens-league.md) | Check and fix the home page and team pages for the women's competitions | S |
| [08 · Archive videos](08-archive-videos.md) | Measure how fast past season videos are being found, and speed it up if needed | S |
| [09 · Cup brackets](09-cup-brackets.md) | A knockout bracket for the cups, and for leagues whose knockout matches hang from the competition | L |
| [10 · Lineups on a pitch](10-lineups-on-pitch.md) | Dropped: replaced by the ideal 7 (see `docs/plan.md`) | M |
| [11 · A real 404](11-real-404.md) | Missing matches, teams and players answer 404 instead of 200 | S |
| [12 · End-to-end sync test](12-sync-e2e-test.md) | The whole sync tested offline against recorded API responses | M |
| [13 · Accessibility review](13-accessibility.md) | Contrast, keyboard and screen reader review and fixes | M |
| [14 · Targeted revalidation](14-targeted-revalidation.md) | After a sync, rebuild only the pages whose data changed; measure first whether it is still worth it | M |

Done (25 Oct 2026): 01, 02, 03, 04, 05, 06, 07, 08 and 11 (partly: see `docs/plan.md`); 09 and 12 on 26 Oct; 10 dropped for the ideal 7.
Next, in order of value: 13. 14 waits for its second measurement (~1 Nov 2026). 10 is optional. The open plans
are independent of each other and can run in parallel.

## Before starting a plan

Read [`AGENTS.md`](../../AGENTS.md) at the repository root: the architecture, the rules every change follows, how to
run and check the site (including screenshots at 1280 and 390 px and using production data read-only), and how to
deliver (a branch, small Conventional Commits, `docs/plan.md` updated). The plans assume all of it.

When you finish, report what you could not verify.

# 14 · Targeted revalidation

## Why

Every page caches its database reads under one tag, `data` (`DATA_TAG` in `src/lib/data.ts`). When the sync writes
anything, `scripts/sync.ts` calls `POST /api/revalidate`, which invalidates that tag, so every page in the site is
stale and is rebuilt (re-reading Turso) the next time someone opens it.

The sync writes something on almost every run. On 23 Oct 2026, the last five runs with "0 teams updated, 0 matches
updated" all ended with "Site revalidation: 200", because finding a match video counts as a write
(`ctx.writes += 1` in `backfillMatchVideos`), even for a 2024 match. A video for one old match makes the home
page, every team, every competition and every player page re-read the database.

Turso is on the free plan with overages disabled (500M rows read a month; past it, reads fail and the site goes
down), so reads the site does not need are worth removing.

## First, decide whether it is still worth it

Most of today's writes come from the archive video backfill (5,326 matches left on 23 Oct 2026, ~190 per run), which
will finish within a few days. After that, many runs may write nothing and not revalidate at all. Before building
anything:

1. **Count revalidations.** Over a few days after "Videos (archive)" stops appearing as pending, count the sync runs
   that log "Site revalidation" against those that do not (`gh run list --workflow sync.yml`, `gh run view <id>
   --log`). Note what caused the writes in each.
2. **Measure the site's reads.** `turso plan show` gives the month's total. The sync now reads ~20,000–25,000 rows a
   run (~11–14M a month at ~570 runs); the rest is the site. `turso db inspect futbolempresas --queries` shows the
   heaviest queries. Compare a day with many revalidations against a quiet one.
3. **Decide.** If the site's reads are a small share of the quota, or most runs no longer revalidate, stop here and
   do only the cheap fix in step 1 below (accurate change detection). Write the numbers in `docs/plan.md` either way.

## What to build

### 1. Count only real changes (cheap, worth doing in any case)

`ctx.writes` counts work done, not data changed:

- `saveMatches` adds `rows.length` for every match it saves. The changes pass asks for matches modified since the
  last run minus 60 minutes (`OVERLAP_MINUTES`), so it saves the same matches again on consecutive runs.
- `syncSquad` and `syncTeamDetail` add 1 per team, changed or not.

Make them report a change only when a stored value differs: compare the incoming rows with the stored ones (one
primary key lookup per row, as `recordLatestTeams` already does for players) before writing. A run where nothing
differs then makes no revalidation request.

### 2. Tags per entity

Give each cached read in `src/lib/data.ts` tags for the entities it reads, as well as `DATA_TAG`:

| Read | Tags |
| --- | --- |
| `getMatch(id)` | `match:<id>` |
| `getTeamMatches(teamId)`, `getSquad(teamId)`, `getTeam(slug)` | `team:<id>` |
| `getGroupMatches(groupId, seasonId)` | `group:<groupId>:<seasonId>` |
| `getSeasonMatches(seasonId)` | `season:<seasonId>` |
| `getHeadToHead(a, b)` | `team:<a>`, `team:<b>` |
| `getPlayerCareer(playerId)`, `getPlayers(ids)` | `player:<id>` (each) |
| catalog reads (`getSeasons`, `getLeagues`, `getTeams`, `getGroupSeasons`, tournaments, news) | `catalog` |

Tags of nested `"use cache"` scopes propagate to the outer one (the build showed it with the search index), so the
view functions in `src/lib/views/` and the pages inherit them without changes. Check that in the Next docs
(`cacheTag`, nested caching) before relying on it, and check the limits on the number and length of tags per entry.

### 3. The sync records what changed

Collect the affected tags in the sync's `Context` as it writes:

- a match whose score, date, status, lineup or video changed: `match:<id>`, `team:<home>`, `team:<away>`,
  `group:<group>:<season>`, `season:<season>`, and `player:<id>` for its lineup;
- a match whose only change is its video: `match:<id>` and its two teams (the team page lists matches with video);
- a team whose details or squad changed: `team:<id>`, plus `player:<id>` for players whose row changed;
- seasons, leagues, tournaments, news, team names or crests: `catalog`.

Send them in the revalidation request (`{ "tags": [...] }`), and have `/api/revalidate` invalidate each one. Past a
limit (a full backfill or `sync:reset`, say over 200 tags), send `DATA_TAG` instead, as today. Keep the existing
`search` flag.

### 4. Pages that read the time

The views read the current time inside their caches (`nowInMadrid()` in `home.ts`, `team.ts`, `match.ts`,
`competition.ts`, `venue.ts`, `day.ts`, `player.ts`), and the `results` cache profile in `next.config.ts` expires
after 5 minutes so that "Hoy", the current round and the featured match move on with the clock. This plan does not
change that: those pages keep rebuilding on their timer when visited. Lengthening it needs the time-dependent parts
moved out of the cache, which is a separate piece of work. Mention it in `docs/plan.md` if the measurements in the
first section point at it.

## Related

The archive video query (`videoPending` with `current: false`) still reads ~10,000–16,000 rows on every run once
nothing is left, because it orders all of `matches` by date to find none. A "done" mark in `sync_state`, as
`backfillPlayerNames` has (`backfill:player-names`), would remove it.

## Done when

- A sync run with no real change makes no revalidation request.
- A run that only finds a video for an old match revalidates that match page and its two teams, not the home page
  or other teams (check by watching which pages re-read the database in `next dev` logs, or with
  `turso db inspect --queries` before and after).
- A new result still updates the home page, both teams, the group and the match page within one sync.
- `docs/plan.md` records the measurements behind the decision.

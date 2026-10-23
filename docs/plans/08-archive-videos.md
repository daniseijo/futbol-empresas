# 08 · Archive videos

## Why

`docs/plan.md` has "Past season videos" pending: the "Videos (archive)" sync task is last in the queue and nobody has
checked how it is doing. Match pages show the highlights when `matches.video_id` is set, so every season it skips is
a season of match pages without video.

## Where it stands (production, 23 Oct 2026)

| Season | Played | Checked | With video |
| --- | --- | --- | --- |
| 26/27 | 331 | 331 | 308 |
| 25/26 | 2,972 | 2,972 | 2,447 |
| 24/25 | 2,807 | 677 | 573 |
| 23/24 | 2,446 | 0 | 0 |
| 22/23 | 1,907 | 0 | 0 |

About 6,500 matches are left. The task (`backfillMatchVideos` with `current: false` in `src/sync/run.ts`) reads each
match's web page, ~13 s per page, 6 at a time (`PAGE_CONCURRENCY`), newest first, only with the time the sync
budget has left after everything else. Regular runs have a 15-minute budget; the weekend run (`0 7 * * 6,0` in
`.github/workflows/sync.yml`) has 330 minutes and should do most of the work. 85 % of the checked matches have a video so far, but older seasons may have
fewer.

Query used (read-only token, see `AGENTS.md`):

```sql
select s.name, count(*) played, sum(video_checked_at is not null) checked, sum(video_id is not null) found
from matches m join seasons s on s.id = m.season_id where played = 1 group by s.name order by s.name;
```

## What to do

1. **Measure the pace.** Read the last ~10 runs of the sync workflow (`gh run list --workflow sync.yml`,
   `gh run view <id> --log`) and look for the `Videos (archive): N found in M matches` lines. Work out matches per
   day and the date the archive will be finished at that pace.
2. **If it finishes within about a month, leave it alone.** Note the expected date in `docs/plan.md`.
3. **If it is much slower**, pick the cheapest of:
   - one-off `workflow_dispatch` runs with a longer `budget_minutes` input (the job's `timeout-minutes` grows with
     it), started by the owner from GitHub, never `pnpm sync` against production from a laptop;
   - giving the archive task a fixed share of each run's budget so it is not always starved by the tasks before it.
   Do not raise `PAGE_CONCURRENCY`: the league's web server slows down sharply above 6 requests at once.
4. **Check older pages really have the video where `parseMatchVideo` looks.** Open two or three 22/23 match pages
   on futbolempresas.es (`/evento/<id>/` or the match `link`), and run `fetchMatchVideo` on them from a scratch
   script. If the markup changed between seasons, add a parse test with the old HTML in `parse.test.ts` and fix the
   parser.

## Done when

- `docs/plan.md` says how many archive matches have a video and when (or whether) the rest will be done.
- Any parser change has a test with a real old page.

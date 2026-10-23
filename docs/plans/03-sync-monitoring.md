# 03 · Sync monitoring

## Why

Everything the site shows depends on `.github/workflows/sync.yml`. If it stops, the site silently shows old
results. Two risks:

- **Scheduled runs not happening.** On 23 October 2026 every scheduled run so far had been `skipped`: the job is
  gated by `if: vars.SYNC_ENABLED == 'true'` and the variable was only created at 06:27 UTC that day. Two manual
  runs after that succeeded (about 15 minutes each, the budget). The first scheduled run with the variable set was
  due at 09:07 UTC. Also, GitHub disables schedules in public repositories after 60 days without commits.
- **Failures nobody sees.** Scheduled workflow failures only email whoever last edited the cron lines, and that is
  easy to miss.

## What to build

1. Confirm scheduled runs are actually running and succeeding.
2. An alert that is hard to miss: an issue in the repository that opens when the sync fails and closes itself
   when it recovers.
3. A guard against the 60-day schedule shutdown.

## How

1. **Check:** `gh run list --workflow sync.yml --limit 20` and `gh run view <id> --log` on a recent scheduled run.
   Confirm there are `schedule` runs with `success` after 23 October 2026, on match nights (every 20 minutes,
   17:00–23:59 UTC, Monday to Friday) and every 3 hours otherwise. If they are still `skipped`, check
   `gh variable list` shows `SYNC_ENABLED=true` as a repository **variable** (not a secret). Record what you
   found in `docs/plan.md` (section 2, "Check the first scheduled runs").
2. **Alert:** add `permissions: issues: write` to the job and two final steps:
   - `if: failure()`: with `gh` and `GITHUB_TOKEN`, look for an open issue labelled `sync-failure`; comment on it
     with the run link if it exists, otherwise create it ("La sincronización ha fallado", run link, date). Create
     the label if missing.
   - `if: success()`: close any open `sync-failure` issue with a comment linking the run that recovered.

   Opening an issue notifies the repository owner by email and in the GitHub app. Do not alert on a single
   timeout of the budget: `pnpm sync` stops itself at `SYNC_BUDGET_SECONDS` and that is a success.
3. **Schedule keepalive:** commits from the sync do not exist (it writes to Turso), so after 60 quiet days the
   schedule stops. Either add a small monthly workflow that calls the GitHub API to re-enable `sync.yml`
   (`gh workflow enable sync.yml`, needs `actions: write`), or document clearly in `README.md` how to re-enable it.
   Prefer the workflow, and keep it dependency-free (no third-party keepalive actions).
4. **Optional:** the site footer shows when data was last synced (`src/components/last-sync.tsx`). If the last sync
   is older than, say, 12 hours on a weekday, show it in `text-loss` so a stale site is visible to readers too.

## Done when

- `docs/plan.md` records that scheduled runs work (with a date and a run link), or what is wrong.
- A failing run opens one `sync-failure` issue (test it with a temporary step that runs `exit 1` under
  `workflow_dispatch`, then remove it), repeated failures comment on it, and the next successful run closes it.
- The keepalive is in place or documented.

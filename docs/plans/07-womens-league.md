# 07 · Women's league

## Why

The site was built and checked with the men's Liga Apertura. The women's competitions, "Liga Apertura Femenina"
(league id 539) and "Liga Clausura Femenina" (542), are small (5 teams in the Apertura, 20 matches) and may have
no groups or phases, which the code often assumes. `docs/plan.md` has this check pending.

## What to check

Set the focus team to a women's team and walk the site:

```sh
NEXT_PUBLIC_FOCUS_TEAM_SLUG=telefonica-femenino pnpm dev
```

Other women's teams: `amadeus-femenino`, `fever-femenino`, `roche-femenino`, `meteco`, `adagio-consultoria`.

1. **Home page** (`src/app/page.tsx`, `src/lib/views/home.ts`):
   - "Tu equipo": header line ("Liga Apertura Femenina · … "): with no phase or group it must not show empty
     separators or repeat the competition name. Standings, position and the "En el grupo" tile must be right.
   - The featured match (result or preview, `src/lib/views/featured.ts`) and its footer line.
   - The day strip: women's matches are labelled with the competition name (`label`), check it reads well.
   - Top scorers, group leaders and big wins only use the main competition (the one with the most matches). Decide
     whether the women's league deserves its own top scorers block, or at least a link to its competition page.
2. **Team pages** (`/equipos/<slug>` and every tab): header chips, standings tab, matches (bye weeks, computed
   from group rounds), squad, history.
3. **Competition page** (`/competiciones/...` for 539): table, rounds, leaders.
4. **Match pages:** a known oddity is the same player in both lineups (a goalkeeper lent between teams); check the
   lineups, the goal timeline and the MVP card handle it.
5. **Titles naming another team:** "Roche Pharma" in a title when Roche Femenino plays; the name must come from the
   linked team everywhere (see "Known API oddities" in `docs/plan.md`).

## How

- Fix what is broken with the smallest change, in the shared code paths (do not branch on "is women's league" unless
  the data really differs). Where the issue is "no group", check `TeamContext.group` in
  `src/lib/views/team-context.ts`: the deepest league can be the competition itself.
- Take screenshots of each page at 1280 and 390 px before and after (`scripts/screenshot.mjs`).
- Write down anything you decide not to fix in `docs/plan.md`.

## Done when

- With `NEXT_PUBLIC_FOCUS_TEAM_SLUG=telefonica-femenino` the home page and the team's tabs show correct, complete
  information with no empty separators, "undefined", or men's league data where the women's should be.
- The default (Embat) home page is unchanged.
- `docs/plan.md`'s "Women's league" item is ticked, with any follow-ups listed.

# 09 · Cup brackets

## Why

Knockout cups show on `/competiciones/...` as a standings table with every team plus "rounds" that are just match
days (`buildRounds` in `src/lib/views/competition.ts` falls back to `dayKey` when a match has no round). A table of
points makes no sense for a knockout: what people want to see is who knocked out whom and how far their team got.

## The data

Two cup competitions (production, Oct 2026):

- **Corporate Cup** (league 113): played in September, before the league. Up to 23/24 it had three divisions as
  children (529 Primera, 530 Segunda, 671 Tercera), 15 matches each = a 16-team bracket (8 + 4 + 2 + 1). Since
  24/25 all 60 matches hang from 113 itself (four 16-team brackets mixed together, or one bigger bracket: check).
  26/27 has 46 so far.
- **Copa de las Empresas** (378): played in June, after the league. A group stage first (Grupo A, B…: 5–7 matches,
  rounds 1–3), then a knockout: in 22/23 per division (391, 392, 393, 698, 699: ~15 matches each), since 23/24 all
  under 378 itself (74–90 matches).

None of the knockout matches has a `round`. Some details seen:

- A final can end in a draw (Securitas Direct 1–1 Grupo Cobra, 25 Sep 2023): penalties are not in the score.
- A match can have no score at all (Double FF – Iberdrola, the 2022 final, `home_goals` null).
- Team names in titles vary ("Alfa Microgés" / "Alfa Microges", "Roche GIS" / "Roche Gis"): always use team ids.
- `tournaments` (`winnerId`) holds the champion of some of them: use it to settle a drawn final.

## What to build

1. **Infer the bracket** in a pure function, `src/lib/bracket.ts`, with tests (`bracket.test.ts`, fixtures from
   real seasons). Input: the node's knockout matches. Output: rounds (`"Octavos"`, `"Cuartos"`, `"Semifinales"`,
   `"Final"`, and `"Dieciseisavos"` when needed), each a list of ties `{ match, winnerId | null }`, ordered so each
   tie sits next to the tie it feeds into.
   - A team plays at most once per round. Walk matches by date; a team's n-th knockout match is in round n of its
     path. Group into rounds by "the winners of round n play in round n+1".
   - Several brackets under one node (Corporate Cup since 24/25): split them into connected components of the
     "team played team" graph and show one bracket per component, named by the final's winner or "Cuadro 1, 2…".
   - Winner of a draw: the team that appears in the next round; for the final, `tournaments.winnerId`; else none.
   - If the matches do not form a clean bracket (byes, a missing match, a replayed tie), return `null` and the page
     falls back to today's list. Never show a wrong bracket.
2. **Group stage + knockout in one node** (Copa de las Empresas): the group matches live in child groups, the
   knockout ones in the parent. The parent page should show the bracket and keep the child cards for the groups.
3. **UI** (`src/app/competiciones/[...path]/page.tsx`, a new `src/components/bracket.tsx`): columns per round at
   1280 px, with connecting lines; at 390 px one round at a time with tabs ("Octavos · Cuartos · …"), opening on
   the current or last round. Each tie: crests, names, score, the winner in bold, a link to the match. Highlight the
   focus team's path in `accent-soft`. No standings table for a node that has a bracket.
4. **Team pages**: in the team's matches list, label cup knockout matches with their round ("Cuartos") instead of
   the date-only label, if `bracket.ts` makes that cheap.

## Done when

- The 22/23 and 23/24 Corporate Cup divisions, 25/26 Corporate Cup and 25/26 Copa de las Empresas show a correct
  bracket (check a few ties against futbolempresas.es).
- 26/27 Corporate Cup (in progress or incomplete) shows what it can or falls back cleanly.
- Works at 390 px without horizontal page scroll; tests cover a clean bracket, two brackets in one node, a drawn
  final and a broken bracket.

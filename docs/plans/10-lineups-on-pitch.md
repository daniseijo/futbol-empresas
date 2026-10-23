# 10 · Lineups on a pitch

## Why

The match page's "Alineaciones" card (`Lineups` in `src/app/partidos/[id]/page.tsx`) is two lists sorted by
position. A pitch view is what people expect from a football site and makes the lineup readable at a glance. It is
marked optional in `docs/plan.md`: do it only as an extra view, the list stays.

## The data

- `match_players` rows per team: `position` is one of `POR`, `DEF`, `MED`, `DEL` (40 rows of 280,000 are null),
  `number`, name, photo, goals, cards, MVP (`crack`).
- No formation, no starters vs substitutes, no order within a line: all the players who took part are listed.
  7-a-side teams often bring 10–14 players, so a "pitch" will have more than 7 players on it.
- About half the players have no name (private profile): show the shirt number, as the list does.

## What to build

1. A toggle above the lineups, "Lista · Campo" (default "Lista"; remember the choice in `localStorage`, wrapped in
   try/catch). Small client component; the data is already on the page.
2. `src/components/lineup-pitch.tsx`: a pitch drawn in CSS/SVG with the site's tokens (no grass green photo: a
   `surface` pitch with `line` markings, or a very soft tint), one half per team at 1280 px (home left, away right,
   horizontal pitch), and one team at a time on phones (vertical pitch, tabs with the two crests).
3. Lines by position: POR at the goal, then DEF, MED, DEL. Spread each line's players evenly; when a line has more
   than 4, wrap it into two rows. Null position: a "Sin posición" strip below the pitch.
4. Each player: `PlayerAvatar` (photo, or number/initials), the short name (first name + first surname, or
   "Dorsal 7"), and small badges for goals, cards (`CardIcon`, never coral) and MVP. Each one links to
   `/jugadores/[id]`.
5. Hide the toggle when a team has no lineup published.

## Done when

- The pitch reads well with 7, 10 and 14 players per team, with and without photos, at 1280 and 390 px.
- No horizontal page scroll; the list view is unchanged.
- Keyboard: the toggle is a proper radio group or tabs, and each player is a focusable link.

# 13 · Accessibility review

## Why

Nobody has reviewed the site with a keyboard, a screen reader or a contrast checker. `docs/plan.md` names three
suspects: coral on white, focus, and the match timeline with a screen reader.

## What we know

Contrast of the tokens in `src/app/globals.css` (WCAG 2.x; 4.5 for normal text, 3 for large text and UI shapes):

| Pair | Ratio | |
| --- | --- | --- |
| `accent` #f0533b on white | 3.50 | only for large text, fills and icons |
| `accent-text` #c2321e on white | 5.57 | fine |
| `accent-text` on `accent-soft` | 4.77 | fine |
| `ink` on `accent` (buttons) | 5.50 | fine |
| `muted` on white / on `canvas` | 6.77 / 6.21 | fine |
| `loss` on `loss-soft` | 5.75 | fine |
| `card-yellow` on white | 1.61 | needs an outline or a label next to it |

So the risk is wherever `accent` (not `accent-text`) colours small text, borders that carry meaning (the selected
tab, the focus team's row) or icons on their own.

## What to check and fix

1. **Contrast:** grep for `text-accent`, `border-accent`, `bg-accent` and inline colours; any small text in
   `accent` moves to `accent-text`. Yellow cards: make sure `CardIcon` has a darker outline and an accessible name.
2. **Keyboard:** tab through the home page, a team (all tabs), a match, a competition, a player, a venue, the day
   page and the search. Everything reachable, a visible focus (`:focus-visible` in `globals.css`) everywhere,
   including on the coral buttons and inside cards that are one big link; no focus lost on hidden `<Activity>`
   pages (see `AGENTS.md`); the search combobox works with arrows, Enter and Escape.
3. **Screen reader** (VoiceOver on macOS and iOS):
   - the scoreboard reads as "Imageen Gamhur 2, Embat 1", not "2 – 1" with no teams;
   - `MatchTimeline` (`src/components/match-timeline.tsx`): each event reads as minute, team, player and event
     ("Minuto 23, gol de Telmo Lertxundi, Mutua Madrileña"); visual-only marks get `aria-hidden`;
   - `FormBadges` (V/E/D) read as "Victoria, empate, derrota", not letters;
   - `PlayerEvents` and `CardIcon` have text alternatives ("2 goles, tarjeta amarilla");
   - crests and player photos: decorative ones `alt=""` when the name is next to them;
   - the venue map (`venue-map.tsx`) has a text alternative (the address is already on the page) and does not trap
     focus.
4. **Structure:** one `h1` per page, headings in order, `main`/`nav`/`footer` landmarks, tables (`StandingsTable`)
   with header cells and a caption or `aria-label`, `lang="es"` on `<html>`.
5. **Motion and zoom:** honour `prefers-reduced-motion` for any animation; the layout survives 200 % text zoom at
   390 px.
6. Run Lighthouse's accessibility audit (or axe) on each page type at 390 px and fix what it finds; record the
   scores before and after in the PR.

## Done when

- No small text in `accent`; every interactive element has a visible focus.
- VoiceOver reads a match page (scoreboard, timeline, lineups) in a way that makes sense without seeing it.
- Lighthouse accessibility ≥ 95 on the home, team, match and competition pages.

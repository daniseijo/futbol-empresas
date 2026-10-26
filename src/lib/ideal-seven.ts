// The ideal 7: the best goalkeeper, two defenders, two midfielders and two
// forwards of a competition, group or team, by the score the league uses for
// its own "7 ideal" (futbolempresas.es/LIGA-APERTURA). It is not in the API:
// worked out from the match sheets, it matched the league's seven players and
// their scores exactly in October 2026.

import type { Position } from "@/lib/sportspress/types";

/** A player's match sheets for one team in one line, added up. */
export interface SheetTotals {
  playerId: number;
  teamId: number;
  position: Position | null;
  matches: number;
  /** The league's points per match ("puntuación"). */
  points: number;
  goals: number;
  assists: number;
  /** Player of the match. */
  cracks: number;
  dandies: number;
  /** Matches their team did not concede in. */
  cleanSheets: number;
}

export interface IdealPlayer {
  playerId: number;
  /** The team they played the most matches for. */
  teamId: number;
  position: Position;
  score: number;
  matches: number;
}

/** From the forwards back, as the pitch is drawn. */
export const IDEAL_SHAPE: [Position, number][] = [
  ["DEL", 2],
  ["MED", 2],
  ["DEF", 2],
  ["POR", 1],
];

/** Match points, plus 1 per goal, 0.5 per assist, 2 per MVP, 1 per Dandy and, for a goalkeeper, 2 per clean sheet. */
export function sheetScore(t: SheetTotals): number {
  return t.points + t.goals + t.assists / 2 + 2 * t.cracks + t.dandies + (t.position === "POR" ? 2 * t.cleanSheets : 0);
}

/**
 * The ideal 7 from everyone's totals. Each player counts in the line they
 * played most matches in. Ties go to more MVPs, then more goals. A line with
 * too few players is left short.
 */
export function idealSeven(totals: SheetTotals[]): Record<Position, IdealPlayer[]> {
  const players = new Map<
    number,
    { score: number; matches: number; cracks: number; goals: number; byPosition: Map<Position, number>; byTeam: Map<number, number> }
  >();
  for (const t of totals) {
    const entry = players.get(t.playerId) ?? { score: 0, matches: 0, cracks: 0, goals: 0, byPosition: new Map(), byTeam: new Map() };
    entry.score += sheetScore(t);
    entry.matches += t.matches;
    entry.cracks += t.cracks;
    entry.goals += t.goals;
    if (t.position) entry.byPosition.set(t.position, (entry.byPosition.get(t.position) ?? 0) + t.matches);
    entry.byTeam.set(t.teamId, (entry.byTeam.get(t.teamId) ?? 0) + t.matches);
    players.set(t.playerId, entry);
  }
  const most = <K>(counts: Map<K, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const ranked = [...players.entries()]
    .map(([playerId, p]) => ({ playerId, ...p, position: most(p.byPosition), teamId: most(p.byTeam)! }))
    .filter((p) => p.position !== undefined)
    .sort((a, b) => b.score - a.score || b.cracks - a.cracks || b.goals - a.goals || a.playerId - b.playerId);
  return Object.fromEntries(
    IDEAL_SHAPE.map(([position, count]) => [
      position,
      ranked
        .filter((p) => p.position === position)
        .slice(0, count)
        .map((p) => ({ playerId: p.playerId, teamId: p.teamId, position, score: p.score, matches: p.matches })),
    ]),
  ) as Record<Position, IdealPlayer[]>;
}

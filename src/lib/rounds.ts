import { daysBetween } from "./dates";
import type { Match } from "./sportspress/types";

/** How far from a round's dates a match without a round can be and still join it. */
const MAX_DAYS_AWAY = 7;

/**
 * The API leaves out the round of a match whose title lacks the "J1 –" prefix (Singular Bank – Openbank in the
 * Champions' first round of 26/27), so that match looks like a round of its own and its teams like they rest.
 * In a group whose other matches have rounds, such a match belongs to the round whose dates contain it, or the
 * nearest one, in which neither of its teams already plays. Groups where no match has a round (knockouts) are
 * left alone, and so is a match no round fits.
 */
export function fillMissingRounds<T extends Match>(matches: T[]): T[] {
  const byGroup = new Map<number, T[]>();
  for (const match of matches) {
    if (match.groupId !== null) byGroup.set(match.groupId, [...(byGroup.get(match.groupId) ?? []), match]);
  }
  const filled = new Map<number, number>();
  for (const group of byGroup.values()) {
    const missing = group.filter((m) => m.round === null);
    if (missing.length === 0 || missing.length === group.length) continue;
    const rounds = new Map<number, { first: string; last: string; teams: Set<number> }>();
    for (const m of group) {
      if (m.round === null) continue;
      const round = rounds.get(m.round) ?? { first: m.date, last: m.date, teams: new Set<number>() };
      if (m.date < round.first) round.first = m.date;
      if (m.date > round.last) round.last = m.date;
      round.teams.add(m.homeId).add(m.awayId);
      rounds.set(m.round, round);
    }
    for (const m of missing) {
      let best: { round: number; distance: number } | null = null;
      for (const [number, round] of rounds) {
        if (round.teams.has(m.homeId) || round.teams.has(m.awayId)) continue;
        const distance = m.date < round.first ? daysBetween(m.date, round.first) : m.date > round.last ? daysBetween(round.last, m.date) : 0;
        if (distance <= MAX_DAYS_AWAY && (!best || distance < best.distance)) best = { round: number, distance };
      }
      if (!best) continue;
      filled.set(m.id, best.round);
      rounds.get(best.round)!.teams.add(m.homeId).add(m.awayId);
    }
  }
  if (filled.size === 0) return matches;
  return matches.map((m) => (filled.has(m.id) ? { ...m, round: filled.get(m.id)! } : m));
}

import type { Match } from "@/lib/sportspress/types";

// The league publishes each round about a week ahead, so a phase in progress has
// far fewer matches in the database than it will have. These rules estimate the
// real total. Round numbers do not help: some matches are played early under a
// later round, and some have none.

/** Matches of a single round robin between `teams` teams. */
export function roundRobin(teams: number): number {
  return (teams * (teams - 1)) / 2;
}

/** The only fields these rules read from a match. */
export type Pairing = Pick<Match, "groupId" | "homeId" | "awayId">;

function byGroup<T extends Pairing>(matches: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const match of matches) {
    if (match.groupId === null) continue;
    groups.set(match.groupId, [...(groups.get(match.groupId) ?? []), match]);
  }
  return groups;
}

function teamsOf(matches: Pairing[]): Set<number> {
  return new Set(matches.flatMap((m) => [m.homeId, m.awayId]));
}

/**
 * Groups of a finished season that were a single round robin: no pair met twice
 * and at least ¾ of the round robin was published (a phase cut short still
 * counts). Knockouts and the Champions league phase, where each team plays a
 * few rivals, are not.
 */
export function roundRobinGroups(matches: Pairing[]): Set<number> {
  const result = new Set<number>();
  for (const [groupId, list] of byGroup(matches)) {
    const total = roundRobin(teamsOf(list).size);
    const pairs = new Set(list.map((m) => [m.homeId, m.awayId].sort((a, b) => a - b).join("-")));
    if (total >= 3 && pairs.size === list.length && list.length <= total && list.length >= total * 0.75) result.add(groupId);
  }
  return result;
}

/**
 * Groups of a finished season that were a league phase, as in the Champions: each team played the same few
 * rivals once (4 in 25/26), not all of them. The value is the matches each team played. A team that withdrew
 * leaves itself and its rivals short, so ¾ of the teams playing the same number is enough; in a knockout,
 * where winners play more, about half play once.
 */
export function leaguePhaseGroups(matches: Pairing[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const [groupId, list] of byGroup(matches)) {
    const pairs = new Set(list.map((m) => [m.homeId, m.awayId].sort((a, b) => a - b).join("-")));
    if (pairs.size !== list.length) continue;
    const played = new Map<number, number>();
    for (const id of list.flatMap((m) => [m.homeId, m.awayId])) played.set(id, (played.get(id) ?? 0) + 1);
    const counts = new Map<number, number>();
    for (const n of played.values()) counts.set(n, (counts.get(n) ?? 0) + 1);
    const [rounds, teams] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (rounds >= 2 && rounds < played.size - 1 && teams >= played.size * 0.75) result.set(groupId, rounds);
  }
  return result;
}

export interface ExpectedRules {
  /** Whether the group plays a single round robin. */
  isRoundRobin: (groupId: number) => boolean;
  /** The matches each team plays if the group is a league phase (see `leaguePhaseGroups`). */
  leaguePhaseRounds: (groupId: number) => number | undefined;
  /** Whether the team is registered in the group; false drops a match tagged with the wrong group. */
  belongs: (teamId: number, groupId: number) => boolean;
}

/**
 * The matches the groups will have once every round is published: a round robin
 * between the group's teams, or each team's rounds in a league phase, or the
 * published matches if there are more (or the group is neither, like a knockout).
 */
export function expectedTotal(matches: Match[], rules: ExpectedRules): number {
  let total = 0;
  for (const [groupId, list] of byGroup(matches)) {
    const rounds = rules.leaguePhaseRounds(groupId);
    if (!rules.isRoundRobin(groupId) && rounds === undefined) {
      total += list.length;
      continue;
    }
    const all = [...teamsOf(list)];
    const members = all.filter((id) => rules.belongs(id, groupId));
    const teams = members.length >= 2 ? members.length : all.length;
    const expected = rules.isRoundRobin(groupId) ? roundRobin(teams) : Math.floor((teams * rounds!) / 2);
    total += Math.max(expected, list.length);
  }
  return total + matches.filter((m) => m.groupId === null).length;
}

import type { Match } from "@/lib/sportspress/types";

// The league publishes each round about a week ahead, so a phase in progress has
// far fewer matches in the database than it will have. These rules estimate the
// real total. Round numbers do not help: some matches are played early under a
// later round, and some have none.

/** Matches of a single round robin between `teams` teams. */
export function roundRobin(teams: number): number {
  return (teams * (teams - 1)) / 2;
}

function byGroup(matches: Match[]): Map<number, Match[]> {
  const groups = new Map<number, Match[]>();
  for (const match of matches) {
    if (match.groupId === null) continue;
    groups.set(match.groupId, [...(groups.get(match.groupId) ?? []), match]);
  }
  return groups;
}

function teamsOf(matches: Match[]): Set<number> {
  return new Set(matches.flatMap((m) => [m.homeId, m.awayId]));
}

/**
 * Groups of a finished season that were a single round robin: no pair met twice
 * and at least ¾ of the round robin was published (a phase cut short still
 * counts). Knockouts and the Champions league phase, where each team plays a
 * few rivals, are not.
 */
export function roundRobinGroups(matches: Match[]): Set<number> {
  const result = new Set<number>();
  for (const [groupId, list] of byGroup(matches)) {
    const total = roundRobin(teamsOf(list).size);
    const pairs = new Set(list.map((m) => [m.homeId, m.awayId].sort((a, b) => a - b).join("-")));
    if (total >= 3 && pairs.size === list.length && list.length <= total && list.length >= total * 0.75) result.add(groupId);
  }
  return result;
}

export interface ExpectedRules {
  /** Whether the group plays a single round robin. */
  isRoundRobin: (groupId: number) => boolean;
  /** Whether the team is registered in the group; false drops a match tagged with the wrong group. */
  belongs: (teamId: number, groupId: number) => boolean;
}

/**
 * The matches the groups will have once every round is published: a round robin
 * between the group's teams, or the published matches if there are more (or the
 * group is not a round robin).
 */
export function expectedTotal(matches: Match[], rules: ExpectedRules): number {
  let total = 0;
  for (const [groupId, list] of byGroup(matches)) {
    if (!rules.isRoundRobin(groupId)) {
      total += list.length;
      continue;
    }
    const teams = [...teamsOf(list)];
    const members = teams.filter((id) => rules.belongs(id, groupId));
    total += Math.max(roundRobin(members.length >= 2 ? members.length : teams.length), list.length);
  }
  return total + matches.filter((m) => m.groupId === null).length;
}

import { getSeasonMatches, getSeasons } from "@/lib/data";
import { roundRobinGroups, type ExpectedRules } from "@/lib/expected-matches";
import type { LeagueTree } from "@/lib/sportspress/leagues";
import type { Season, TeamSummary } from "@/lib/sportspress/types";

/**
 * The rules to estimate a season's total matches. A group is a round robin if it
 * was one the season before; a new group, if every sibling seen then was. A team
 * belongs to the groups it is registered in (the league only keeps the current
 * season's, so this is for the current season only).
 */
export async function expectedRulesFor(season: Season, tree: LeagueTree, teams: TeamSummary[]): Promise<ExpectedRules> {
  const seasons = await getSeasons();
  const previous = seasons.filter((s) => s.name < season.name).at(-1);
  const previousMatches = previous ? await getSeasonMatches(previous.id) : [];
  const roundRobins = roundRobinGroups(previousMatches);
  const seen = new Set(previousMatches.map((m) => m.groupId));
  const leagueIds = new Map(teams.map((t) => [t.id, t.leagueIds]));
  return {
    isRoundRobin: (groupId) => {
      if (seen.has(groupId)) return roundRobins.has(groupId);
      const parentId = tree.get(groupId)?.parentId;
      const siblings = parentId ? tree.children(parentId).filter((child) => seen.has(child.id)) : [];
      return siblings.length > 0 && siblings.every((child) => roundRobins.has(child.id));
    },
    belongs: (teamId, groupId) => {
      const ids = leagueIds.get(teamId);
      return !ids || ids.length === 0 || ids.includes(groupId);
    },
  };
}

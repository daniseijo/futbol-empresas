import { bracketSize, buildKnockout } from "@/lib/bracket";
import { getSeasonMatches, getSeasons } from "@/lib/data";
import type { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, Season } from "@/lib/sportspress/types";

/** Far enough ahead for every final of a past season to count as settled. */
const LONG_AFTER = "9999-12-31T23:59";

/**
 * Teams per bracket in the node's previous season, from its own matches or its children's (the cups were
 * split into divisions up to 23/24): the size a cup in progress is heading for. See `buildKnockout`.
 */
export async function expectedBracketSize(nodeId: number, season: Season, tree: LeagueTree): Promise<number | undefined> {
  const previous = (await getSeasons())
    .filter((s) => s.name < season.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .at(-1);
  if (!previous) return undefined;
  const byGroup = new Map<number, Match[]>();
  for (const m of await getSeasonMatches(previous.id)) {
    if (m.groupId === null || !tree.path(m.groupId).some((league) => league.id === nodeId)) continue;
    byGroup.set(m.groupId, [...(byGroup.get(m.groupId) ?? []), m]);
  }
  return bracketSize([...byGroup.values()].flatMap((list) => buildKnockout(list, { now: LONG_AFTER }).brackets));
}

import type { Match } from "@/lib/sportspress/types";
import { playerDisplayName } from "@/lib/players";
import { featuredMode, positionBefore } from "./featured-rules";
import { getMatchPageData, type MatchPageData } from "./match";
import type { TeamContext } from "./team-context";

/** The match a team's summary puts first (on the home page and the team page). */
export interface Featured {
  /** "result" right after a match; "preview" from the Monday of the week the next one is played. */
  mode: "result" | "preview";
  /** The last match (result) or the next one (preview), with its match sheet. */
  featured: MatchPageData | null;
  /** Position before the last match's round, to tell whether the team moved. */
  previousPosition: number | null;
  daysToNext: number | null;
  /** The team's best rated player in the featured match's competition. */
  mvpLeader: { name: string; points: number } | null;
}

export type FeaturedTeam = TeamContext & Featured;

export async function getFeatured(context: TeamContext, seasonMatches: Match[], now: string): Promise<Featured> {
  const last = context.lastResults[0] ?? null;
  const { mode, matchId, daysToNext } = featuredMode(context, now);
  const featured = matchId ? await getMatchPageData(matchId) : null;

  const previousPosition =
    mode === "result" && last?.round && context.group ? positionBefore(seasonMatches, context.group.id, context.teamId, last.round) : null;

  const side = featured ? (featured.home.id === context.teamId ? featured.home : featured.away) : null;
  const mvp = side?.topRated;
  return {
    mode,
    featured,
    previousPosition,
    daysToNext,
    mvpLeader: mvp ? { name: playerDisplayName(mvp.name, mvp.number), points: mvp.mvpPoints } : null,
  };
}

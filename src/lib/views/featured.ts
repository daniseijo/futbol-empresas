import { daysBetween } from "@/lib/dates";
import type { Match, SquadPlayer } from "@/lib/sportspress/types";
import { computeStandings } from "@/lib/standings";
import { getMatchPageData, type MatchPageData } from "./match";
import type { TeamContext } from "./team-context";

/** Days before the next match from which its preview replaces the last result. */
export const PREVIEW_DAYS = 2;

/** The match a team's summary puts first (on the home page and the team page). */
export interface Featured {
  /** "result" right after a match; "preview" once the next one is PREVIEW_DAYS away or less. */
  mode: "result" | "preview";
  /** The last match (result) or the next one (preview), with its match sheet. */
  featured: MatchPageData | null;
  /** Position before the last match's round, to tell whether the team moved. */
  previousPosition: number | null;
  daysToNext: number | null;
  mvpLeader: { name: string; points: number } | null;
}

export type FeaturedTeam = TeamContext & Featured;

export async function getFeatured(context: TeamContext, seasonMatches: Match[], squad: SquadPlayer[], now: string): Promise<Featured> {
  const last = context.lastResults[0] ?? null;
  const daysToNext = context.nextMatch ? daysBetween(now, context.nextMatch.date) : null;
  const mode = context.nextMatch && (!last || daysToNext! <= PREVIEW_DAYS) ? "preview" : "result";
  const featuredMatch = mode === "preview" ? context.nextMatch : last;
  const featured = featuredMatch ? await getMatchPageData(featuredMatch.id) : null;

  let previousPosition: number | null = null;
  if (mode === "result" && last?.round && context.group) {
    const groupId = context.group.id;
    const before = computeStandings(seasonMatches.filter((m) => m.leagueIds.includes(groupId) && m.round !== last.round));
    previousPosition = before.find((r) => r.teamId === context.teamId)?.position ?? null;
  }

  const mvp = [...squad].sort((a, b) => b.mvpPoints - a.mvpPoints)[0];
  return {
    mode,
    featured,
    previousPosition,
    daysToNext,
    mvpLeader: mvp && mvp.mvpPoints > 0 ? { name: mvp.name, points: mvp.mvpPoints } : null,
  };
}

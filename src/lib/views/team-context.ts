import { daysBetween, dayKey, weekStart } from "@/lib/dates";
import { championsStage, type ChampionsStage } from "@/lib/sportspress/champions";
import type { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, StandingRow } from "@/lib/sportspress/types";
import { computeStandings } from "@/lib/standings";
import { featuredMode } from "./featured-rules";

export interface TeamGroup {
  id: number;
  name: string;
  href: string;
  phase: string | null;
  competition: string;
}

/** A team's situation in the season: its group, standings and matches. */
export interface TeamContext {
  teamId: number;
  group: TeamGroup | null;
  standings: StandingRow[];
  row: StandingRow | null;
  matches: Match[];
  nextMatch: Match | null;
  nextOpponent: StandingRow | null;
  lastResults: Match[];
  /** Where each of the team's Champions matches sits, by match id. */
  champions: Record<number, ChampionsStage>;
}

export function involves(match: Match, teamId: number): boolean {
  return match.homeId === teamId || match.awayId === teamId;
}

export function buildTeamContext(teamId: number, seasonMatches: Match[], tree: LeagueTree, now: string): TeamContext {
  const today = dayKey(now);
  const matches = seasonMatches.filter((m) => involves(m, teamId));
  const upcoming = matches.find((m) => !m.played && dayKey(m.date) >= today) ?? null;
  const lastResults = matches.filter((m) => m.played).reverse();
  const nextMatch = awaitingResult(matches, now, upcoming) ?? upcoming;

  // The "current" group is the featured match's (the last result until the Monday of the next match's week),
  // so the standings beside it are its own even when the two matches are in different competitions.
  const { matchId } = featuredMode({ lastResults, nextMatch }, now);
  const reference = matches.find((m) => m.id === matchId) ?? matches[matches.length - 1];
  const deepest = reference ? tree.deepest(reference.leagueIds) : undefined;
  let group: TeamGroup | null = null;
  let standings: StandingRow[] = [];
  if (deepest) {
    const path = tree.path(deepest.id);
    group = {
      id: deepest.id,
      name: deepest.name,
      href: tree.href(deepest.id),
      phase: path.length > 2 ? path[path.length - 2].name : null,
      competition: path[0]?.name ?? "",
    };
    standings = computeStandings(seasonMatches.filter((m) => m.leagueIds.includes(deepest.id)));
  }

  const champions: Record<number, ChampionsStage> = {};
  for (const match of matches) {
    const stage = championsStage(match, tree);
    if (stage) champions[match.id] = stage;
  }

  const row = standings.find((r) => r.teamId === teamId) ?? null;
  const opponentId = nextMatch ? (nextMatch.homeId === teamId ? nextMatch.awayId : nextMatch.homeId) : null;
  return {
    teamId,
    group,
    standings,
    row,
    matches,
    nextMatch,
    nextOpponent: standings.find((r) => r.teamId === opponentId) ?? null,
    lastResults,
    champions,
  };
}

/** Days after kickoff a match without a score can stay the featured one while the league publishes it. */
const AWAITING_RESULT_DAYS = 7;

/**
 * A match already played whose score the league has not published yet. It stays the team's next match, so the
 * summary keeps its preview instead of putting the match before it in its place, as if that were the latest
 * result. It gives way once a later match has a score, after a week, or from the Monday of the next match's week.
 */
export function awaitingResult(matches: Match[], now: string, upcoming: Match | null): Match | null {
  const today = dayKey(now);
  const pending = matches.findLast((m) => !m.played && dayKey(m.date) < today);
  if (!pending || daysBetween(pending.date, now) > AWAITING_RESULT_DAYS) return null;
  if (matches.some((m) => m.played && m.date > pending.date)) return null;
  if (upcoming && weekStart(upcoming.date) === weekStart(now)) return null;
  return pending;
}

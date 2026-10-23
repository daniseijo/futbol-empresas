import { dayKey } from "@/lib/dates";
import type { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, StandingRow } from "@/lib/sportspress/types";
import { computeStandings } from "@/lib/standings";

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
}

export function involves(match: Match, teamId: number): boolean {
  return match.homeId === teamId || match.awayId === teamId;
}

export function buildTeamContext(teamId: number, seasonMatches: Match[], tree: LeagueTree, now: string): TeamContext {
  const today = dayKey(now);
  const matches = seasonMatches.filter((m) => involves(m, teamId));
  const upcoming = matches.filter((m) => !m.played && dayKey(m.date) >= today);
  const nextMatch = upcoming[0] ?? null;
  const lastResults = matches.filter((m) => m.played).reverse();

  // The "current" group is the next match's or, if there is none, the last one's.
  const reference = nextMatch ?? lastResults[0] ?? matches[matches.length - 1];
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
  };
}

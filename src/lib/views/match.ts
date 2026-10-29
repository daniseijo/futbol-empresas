import { cacheLife } from "next/cache";
import { dayKey, nowInMadrid } from "@/lib/dates";
import { getCurrentSeason, getHeadToHead, getLeagues, getMatch, getSeasonMatches, getSeasons, getSquad, getTeams } from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import { getVenue } from "@/lib/sportspress/venues";
import { playerDisplayName } from "@/lib/players";
import type { LineupPlayer, Match, MatchDetail, SquadPlayer, StandingRow } from "@/lib/sportspress/types";
import { computeStandings, outcomeFor } from "@/lib/standings";

/** League 7-a-side matches are two 25-minute halves. */
const HALF_MINUTES = 25;

export interface GoalEvent {
  minute: number;
  teamId: number;
  playerName: string;
  /** Score after the goal, "2–1". */
  score: string;
}

export interface TeamSide {
  id: number;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  standing: StandingRow | null;
  lineup: LineupPlayer[];
  stats: { goals: number; assists: number; yellowCards: number; redCards: number; points: number; players: number };
  /** Goals in the score missing from the match sheet (own goals or unrecorded). */
  unattributedGoals: number;
  /** Players to watch in the preview: those with the most goals (or MVP points). */
  keyPlayers: SquadPlayer[];
}

export interface MatchPageData {
  match: MatchDetail;
  now: string;
  path: { name: string; href: string }[];
  /** The page with every match of that date; only for the current season. */
  dayHref: string | null;
  home: TeamSide;
  away: TeamSide;
  goals: GoalEvent[];
  /** Half-time score; null if any goal has no minute. */
  halftime: string | null;
  /** The league's "Crack": the player of the match. */
  mvp: LineupPlayer | null;
  round: Match[];
  restingTeam: string | null;
  headToHead: { matches: Match[]; homeWins: number; draws: number; awayWins: number };
}

export async function getMatchPageData(id: number): Promise<MatchPageData | null> {
  "use cache";
  cacheLife("results");

  const result = await getMatch(id);
  if (!result) return null;
  const { lineups } = result;
  const [leagues, seasons, current, teams, seasonMatches, headToHead, homeSquad, awaySquad] = await Promise.all([
    getLeagues(),
    getSeasons(),
    getCurrentSeason(),
    getTeams(),
    result.match.seasonId ? getSeasonMatches(result.match.seasonId) : Promise.resolve([]),
    getHeadToHead(result.match.homeId, result.match.awayId),
    getSquad(result.match.homeId),
    getSquad(result.match.awayId),
  ]);
  const tree = new LeagueTree(leagues);
  // The season's matches carry the round the API left out of some.
  const match = { ...result.match, round: result.match.round ?? seasonMatches.find((m) => m.id === id)?.round ?? null };
  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const groupMatches = match.groupId ? seasonMatches.filter((m) => m.groupId === match.groupId) : [];
  const standings = computeStandings(groupMatches);

  const keyPlayers = (squad: SquadPlayer[]) =>
    [...squad].sort((a, b) => b.goals - a.goals || b.mvpPoints - a.mvpPoints).filter((p) => p.appearances > 0).slice(0, 3);

  const side = (teamId: number, name: string, goalsInScore: number | null, squad: SquadPlayer[]): TeamSide => {
    const lineup = lineups.filter((p) => p.teamId === teamId);
    const stats = {
      goals: lineup.reduce((sum, p) => sum + p.goals, 0),
      assists: lineup.reduce((sum, p) => sum + p.assists, 0),
      yellowCards: lineup.reduce((sum, p) => sum + p.yellowCards, 0),
      redCards: lineup.reduce((sum, p) => sum + p.redCards, 0),
      points: lineup.reduce((sum, p) => sum + p.points, 0),
      players: lineup.length,
    };
    const team = teamsById.get(teamId);
    return {
      id: teamId,
      name,
      slug: team?.slug ?? null,
      logoUrl: team?.logoUrl ?? null,
      standing: standings.find((r) => r.teamId === teamId) ?? null,
      lineup,
      stats,
      unattributedGoals: goalsInScore === null ? 0 : Math.max(0, goalsInScore - stats.goals),
      keyPlayers: keyPlayers(squad),
    };
  };
  const home = side(match.homeId, match.homeName, match.homeGoals, homeSquad);
  const away = side(match.awayId, match.awayName, match.awayGoals, awaySquad);

  // Goal timeline with the running score.
  const raw = lineups
    .flatMap((p) => p.minutes.map((minute) => ({ minute, teamId: p.teamId, playerName: playerDisplayName(p.name, p.number) })))
    .sort((a, b) => a.minute - b.minute);
  let homeScore = 0;
  let awayScore = 0;
  const goals = raw.map((goal) => {
    if (goal.teamId === match.homeId) homeScore += 1;
    else awayScore += 1;
    return { ...goal, score: `${homeScore}–${awayScore}` };
  });
  const everyGoalHasMinute =
    match.played && raw.length === (match.homeGoals ?? 0) + (match.awayGoals ?? 0);
  const firstHalf = raw.filter((g) => g.minute <= HALF_MINUTES);
  const halftime = everyGoalHasMinute
    ? `${firstHalf.filter((g) => g.teamId === match.homeId).length}–${firstHalf.filter((g) => g.teamId === match.awayId).length}`
    : null;

  // Rest of the group's round and who sits out.
  const round = match.round ? groupMatches.filter((m) => m.round === match.round && m.id !== match.id) : [];
  const playing = new Set([match, ...round].flatMap((m) => [m.homeId, m.awayId]));
  const resting = match.round ? standings.find((r) => !playing.has(r.teamId)) : undefined;

  // Head to head: previous meetings, from today's home team's point of view.
  const previous = headToHead.filter((m) => m.id !== match.id && m.played);
  const record = { homeWins: 0, draws: 0, awayWins: 0 };
  for (const m of previous) {
    const outcome = outcomeFor(m, match.homeId);
    if (outcome === "V") record.homeWins += 1;
    else if (outcome === "E") record.draws += 1;
    else if (outcome === "D") record.awayWins += 1;
  }

  // Past seasons carry their parameter in the competition link.
  const season = match.seasonId === current.id ? undefined : seasons.find((s) => s.id === match.seasonId)?.name;
  const path = match.groupId ? tree.path(match.groupId).map((l) => ({ name: l.name, href: tree.href(l.id, season) })) : [];
  return {
    match,
    now: nowInMadrid(),
    path,
    dayHref: match.seasonId === current.id ? `/partidos/dia/${dayKey(match.date)}` : null,
    home,
    away,
    goals,
    halftime,
    mvp: lineups.find((p) => p.crack) ?? null,
    round,
    restingTeam: resting?.name ?? null,
    headToHead: { matches: previous.slice(0, 6), ...record },
  };
}

/**
 * Where the match fits, for link previews: "Liga Apertura · Grupo 20 ·
 * Jornada 4 · RUPE Rodríguez Sahagún". The phase between competition and
 * group is left out to keep it short.
 */
export function matchSummary(data: MatchPageData): string {
  const { match, path } = data;
  const league = path.length > 1 ? [path[0].name, path[path.length - 1].name] : path.map((p) => p.name);
  return [...league, match.round ? `Jornada ${match.round}` : null, getVenue(match.venueId)?.name].filter(Boolean).join(" · ");
}

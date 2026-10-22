import { cacheLife } from "next/cache";
import { nowInMadrid } from "@/lib/dates";
import { getHeadToHead, getLeagues, getMatch, getSeasonMatches, getSquad, getTeams } from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { LineupPlayer, Match, MatchDetail, SquadPlayer, StandingRow } from "@/lib/sportspress/types";
import { computeStandings, outcomeFor } from "@/lib/standings";

/** En fútbol 7 de la liga se juegan dos partes de 25 minutos. */
const HALF_MINUTES = 25;

export interface GoalEvent {
  minute: number;
  teamId: number;
  playerName: string;
  /** Marcador tras el gol, "2–1". */
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
  /** Goles del marcador que no aparecen en el acta (en propia puerta o sin registrar). */
  unattributedGoals: number;
  /** Jugadores a seguir en la previa: los que más goles (o puntos MVP) llevan. */
  keyPlayers: SquadPlayer[];
}

export interface MatchPageData {
  match: MatchDetail;
  now: string;
  path: string[];
  home: TeamSide;
  away: TeamSide;
  goals: GoalEvent[];
  /** Marcador al descanso; null si algún gol no tiene minuto. */
  halftime: string | null;
  /** El «Crack» de la liga: el mejor jugador del partido. */
  mvp: LineupPlayer | null;
  round: Match[];
  restingTeam: string | null;
  headToHead: { matches: Match[]; homeWins: number; draws: number; awayWins: number };
}

function playerName(player: LineupPlayer) {
  return player.name || (player.number ? `Dorsal ${player.number}` : "Jugador");
}

export async function getMatchPageData(id: number): Promise<MatchPageData | null> {
  "use cache";
  cacheLife("resultados");

  const result = await getMatch(id);
  if (!result) return null;
  const { match, lineups } = result;
  const [leagues, teams, seasonMatches, headToHead, homeSquad, awaySquad] = await Promise.all([
    getLeagues(),
    getTeams(),
    match.seasonId ? getSeasonMatches(match.seasonId) : Promise.resolve([]),
    getHeadToHead(match.homeId, match.awayId),
    getSquad(match.homeId),
    getSquad(match.awayId),
  ]);
  const tree = new LeagueTree(leagues);
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

  // Línea de tiempo de goles con el marcador acumulado.
  const raw = lineups
    .flatMap((p) => p.minutes.map((minute) => ({ minute, teamId: p.teamId, playerName: playerName(p) })))
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

  // Resto de la jornada del grupo y quién descansa.
  const round = match.round ? groupMatches.filter((m) => m.round === match.round && m.id !== match.id) : [];
  const playing = new Set([match, ...round].flatMap((m) => [m.homeId, m.awayId]));
  const resting = match.round ? standings.find((r) => !playing.has(r.teamId)) : undefined;

  // Cara a cara: enfrentamientos anteriores, desde el punto de vista del local de hoy.
  const previous = headToHead.filter((m) => m.id !== match.id && m.played);
  const record = { homeWins: 0, draws: 0, awayWins: 0 };
  for (const m of previous) {
    const outcome = outcomeFor(m, match.homeId);
    if (outcome === "V") record.homeWins += 1;
    else if (outcome === "E") record.draws += 1;
    else if (outcome === "D") record.awayWins += 1;
  }

  const path = match.groupId ? tree.path(match.groupId).map((l) => l.name) : [];
  return {
    match,
    now: nowInMadrid(),
    path,
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

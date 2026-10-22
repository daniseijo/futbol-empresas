import { cacheLife } from "next/cache";
import { getCurrentSeason, getGroupMatches, getLeagues, getSeasons, getTeam, getTeamMatches } from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match } from "@/lib/sportspress/types";
import { computeStandings, outcomeFor } from "@/lib/standings";

export interface Tally {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface CompetitionStint {
  groupId: number;
  /** "Liga Apertura › Fase 1 › Grupo 20" */
  path: string[];
  record: Tally;
  /** Puesto en el grupo; null en eliminatorias y fases finales. */
  position: number | null;
  teams: number;
  /** Todos los partidos del grupo jugados (la clasificación es definitiva). */
  finished: boolean;
}

export interface SeasonHistory {
  seasonId: number;
  name: string;
  current: boolean;
  record: Tally;
  stints: CompetitionStint[];
}

export interface TeamHistory {
  seasons: SeasonHistory[];
  total: Tally;
  /** Primera temporada con partidos en la base de datos. */
  since: string | null;
}

/** Más equipos que esto no es un grupo de liga, sino un cuadro o una fase final. */
const MAX_GROUP_TEAMS = 16;

const emptyTally = (): Tally => ({ played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 });

function add(record: Tally, match: Match, teamId: number) {
  const outcome = outcomeFor(match, teamId);
  if (!outcome) return;
  const isHome = match.homeId === teamId;
  record.played += 1;
  record.goalsFor += (isHome ? match.homeGoals : match.awayGoals) ?? 0;
  record.goalsAgainst += (isHome ? match.awayGoals : match.homeGoals) ?? 0;
  if (outcome === "V") record.won += 1;
  else if (outcome === "E") record.drawn += 1;
  else record.lost += 1;
}

/**
 * Historial de un equipo por temporadas, con cada competición en la que jugó,
 * su balance y su puesto en el grupo (calculado a partir de los partidos, porque
 * la API reutiliza la clasificación de cada grupo todas las temporadas).
 */
export async function getTeamHistory(slug: string): Promise<TeamHistory | null> {
  "use cache";
  cacheLife("resultados");

  const team = await getTeam(slug);
  if (!team) return null;
  const [matches, seasons, current, leagues] = await Promise.all([getTeamMatches(team.id), getSeasons(), getCurrentSeason(), getLeagues()]);
  const tree = new LeagueTree(leagues);
  const seasonName = new Map(seasons.map((s) => [s.id, s.name]));

  const bySeason = new Map<number, Map<number, Match[]>>();
  for (const match of matches) {
    if (!match.seasonId || !match.groupId) continue;
    const groups = bySeason.get(match.seasonId) ?? new Map<number, Match[]>();
    groups.set(match.groupId, [...(groups.get(match.groupId) ?? []), match]);
    bySeason.set(match.seasonId, groups);
  }

  const total = emptyTally();
  const history: SeasonHistory[] = [];
  for (const [seasonId, groups] of bySeason) {
    const record = emptyTally();
    const stints: CompetitionStint[] = [];
    for (const [groupId, own] of groups) {
      const stint = emptyTally();
      for (const match of own) {
        add(stint, match, team.id);
        add(record, match, team.id);
        add(total, match, team.id);
      }
      const groupMatches = await getGroupMatches(groupId, seasonId);
      const standings = computeStandings(groupMatches);
      const path = tree.path(groupId).map((l) => l.name);
      // Solo hay puesto en un grupo de liga de verdad. Las eliminatorias y fases
      // finales cuelgan de la competición entera o mezclan decenas de equipos.
      const isLeagueGroup = path.length > 1 && standings.length <= MAX_GROUP_TEAMS;
      stints.push({
        groupId,
        path,
        record: stint,
        position: isLeagueGroup ? (standings.find((r) => r.teamId === team.id)?.position ?? null) : null,
        teams: standings.length,
        finished: groupMatches.length > 0 && groupMatches.every((m) => m.played),
      });
    }
    // Primero la competición con más partidos (la liga), después copas y torneos.
    stints.sort((a, b) => b.record.played - a.record.played);
    history.push({ seasonId, name: seasonName.get(seasonId) ?? "", current: seasonId === current.id, record, stints });
  }
  history.sort((a, b) => b.name.localeCompare(a.name));

  return { seasons: history, total, since: history.at(-1)?.name ?? null };
}

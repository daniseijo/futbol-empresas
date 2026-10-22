import { cacheLife } from "next/cache";
import { siteConfig } from "@/config/site";
import { dayKey, formatLongDate, nowInMadrid } from "@/lib/dates";
import { getCurrentSeason, getGroupSeasons, getLeagues, getPlayers, getSeasonMatches, getSeasons, getTeams } from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, Season, StandingRow } from "@/lib/sportspress/types";
import { computeStandings } from "@/lib/standings";

export interface Crumb {
  name: string;
  href: string;
}

export interface SeasonLink {
  name: string;
  href: string;
}

/** Un grupo, fase o división que cuelga del nodo, con su líder. */
export interface ChildCard {
  id: number;
  name: string;
  href: string;
  teams: number;
  played: number;
  total: number;
  leader: { name: string; points: number } | null;
  hasFocusTeam: boolean;
}

/** Una jornada (o, en las copas sin jornadas, un día de partidos). */
export interface RoundEntry {
  key: string;
  label: string;
  date: string;
  matches: Match[];
  resting: string[];
}

export interface PlayerTally {
  playerId: number;
  name: string;
  photoUrl: string | null;
  team: string;
  value: number;
}

export interface GroupData {
  standings: StandingRow[];
  rounds: RoundEntry[];
  /**
   * La jornada que se enseña por defecto: la primera que empieza hoy o más
   * tarde o, si no queda ninguna, la última. Cuenta el día de su primer partido,
   * para que un partido aplazado no deje la vista en una jornada antigua.
   */
  currentRound: string | null;
}

export interface CompetitionPageData {
  id: number;
  name: string;
  crumbs: Crumb[];
  season: Season;
  isCurrentSeason: boolean;
  seasons: SeasonLink[];
  children: ChildCard[];
  /** Clasificación y jornadas: solo si el nodo tiene partidos propios (un grupo, una copa). */
  group: GroupData | null;
  totals: { teams: number; played: number; total: number; goals: number };
  scorers: PlayerTally[];
  cracks: PlayerTally[];
  focusTeamId: number | null;
  logos: Record<number, string | null>;
  slugs: Record<number, string>;
  now: string;
}

const TALLY_SIZE = 8;

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true });
}

function buildRounds(matches: Match[], standings: StandingRow[]): RoundEntry[] {
  const byKey = new Map<string, Match[]>();
  for (const match of matches) {
    const key = match.round ? String(match.round) : dayKey(match.date);
    byKey.set(key, [...(byKey.get(key) ?? []), match]);
  }
  return [...byKey.entries()]
    .map(([key, list]) => {
      const round = list[0].round;
      const playing = new Set(list.flatMap((m) => [m.homeId, m.awayId]));
      return {
        key,
        label: round ? `Jornada ${round}` : formatLongDate(list[0].date),
        date: list[0].date,
        matches: list,
        resting: round ? standings.filter((row) => !playing.has(row.teamId)).map((row) => row.name) : [],
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Goles o premios de Crack por jugador, de mayor a menor. */
function tally(matches: Match[], pick: (scorer: Match["scorers"][number]) => number): Map<number, { value: number; teamId: number }> {
  const totals = new Map<number, { value: number; teamId: number }>();
  for (const match of matches) {
    for (const scorer of match.scorers) {
      const value = pick(scorer);
      if (value === 0) continue;
      const entry = totals.get(scorer.playerId) ?? { value: 0, teamId: scorer.teamId };
      entry.value += value;
      entry.teamId = scorer.teamId;
      totals.set(scorer.playerId, entry);
    }
  }
  return totals;
}

function top(totals: Map<number, { value: number; teamId: number }>) {
  return [...totals.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, TALLY_SIZE);
}

/**
 * Página de una competición, fase o grupo en una temporada. `segments` es la
 * ruta de la URL y `seasonParam` la temporada pedida ("25-26"); sin ella, la
 * actual o, si el nodo no se jugó este año, la última en que se jugó.
 */
export async function getCompetitionPageData(segments: string[], seasonParam: string | null): Promise<CompetitionPageData | null> {
  "use cache";
  cacheLife("resultados");

  const [leagues, seasons, current, groupSeasons, teams] = await Promise.all([
    getLeagues(),
    getSeasons(),
    getCurrentSeason(),
    getGroupSeasons(),
    getTeams(),
  ]);
  const tree = new LeagueTree(leagues);
  const node = tree.find(segments.map((s) => decodeURIComponent(s)));
  if (!node) return null;

  // Temporadas en las que se jugó algún partido de este nodo o de sus hijos.
  const inSubtree = (groupId: number) => tree.path(groupId).some((league) => league.id === node.id);
  const seasonIds = new Set(groupSeasons.filter((row) => inSubtree(row.groupId)).map((row) => row.seasonId));
  const available = seasons.filter((s) => seasonIds.has(s.id));
  const requested = seasonParam ? seasons.find((s) => s.name === seasonParam.replace("-", "/")) : undefined;
  const fallback = available.some((s) => s.id === current.id) ? current : (available[available.length - 1] ?? current);
  const season = requested ?? fallback;
  // La temporada actual no lleva parámetro: es la que se ve por defecto en casi todos los nodos.
  const seasonHref = (id: number, s: Season) => tree.href(id, s.id === current.id ? undefined : s.name);

  const now = nowInMadrid();
  const today = dayKey(now);
  const seasonMatches = await getSeasonMatches(season.id);
  const matches = seasonMatches.filter((m) => m.groupId !== null && inSubtree(m.groupId));
  const focusTeamId = teams.find((t) => t.slug === siteConfig.focusTeamSlug)?.id ?? null;

  // Hijos con partidos esta temporada, con su líder si son un grupo con clasificación.
  const children: ChildCard[] = tree
    .children(node.id)
    .map((child) => {
      const list = matches.filter((m) => tree.path(m.groupId!).some((league) => league.id === child.id));
      const direct = list.filter((m) => m.groupId === child.id);
      const leader = direct.length > 0 ? computeStandings(direct)[0] : undefined;
      const teamIds = new Set(list.flatMap((m) => [m.homeId, m.awayId]));
      return {
        id: child.id,
        name: child.name,
        href: seasonHref(child.id, season),
        teams: teamIds.size,
        played: list.filter((m) => m.played).length,
        total: list.length,
        leader: leader && leader.played > 0 ? { name: leader.name, points: leader.points } : null,
        hasFocusTeam: focusTeamId !== null && teamIds.has(focusTeamId),
      };
    })
    .filter((child) => child.total > 0)
    .sort((a, b) => naturalCompare(a.name, b.name));

  const direct = matches.filter((m) => m.groupId === node.id);
  let group: GroupData | null = null;
  if (direct.length > 0) {
    const standings = computeStandings(direct);
    const rounds = buildRounds(direct, standings);
    const next = rounds.find((r) => dayKey(r.date) >= today);
    group = { standings, rounds, currentRound: (next ?? rounds[rounds.length - 1])?.key ?? null };
  }

  const scorerTotals = top(tally(matches, (s) => s.goals));
  const crackTotals = top(tally(matches, (s) => (s.crack ? 1 : 0)));
  const players = await getPlayers([...new Set([...scorerTotals, ...crackTotals].map(([id]) => id))]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const toTally = ([playerId, entry]: [number, { value: number; teamId: number }]): PlayerTally => ({
    playerId,
    name: players[playerId]?.name || "Jugador",
    photoUrl: players[playerId]?.photoUrl ?? null,
    team: teamName.get(entry.teamId) ?? "",
    value: entry.value,
  });

  const played = matches.filter((m) => m.played);
  return {
    id: node.id,
    name: node.name,
    crumbs: tree.path(node.id).map((league) => ({ name: league.name, href: seasonHref(league.id, season) })),
    season,
    isCurrentSeason: season.id === current.id,
    seasons: available.map((s) => ({ name: s.name, href: seasonHref(node.id, s) })),
    children,
    group,
    totals: {
      teams: new Set(matches.flatMap((m) => [m.homeId, m.awayId])).size,
      played: played.length,
      total: matches.length,
      goals: played.reduce((sum, m) => sum + (m.homeGoals ?? 0) + (m.awayGoals ?? 0), 0),
    },
    scorers: scorerTotals.map(toTally),
    cracks: crackTotals.map(toTally),
    focusTeamId,
    logos: Object.fromEntries(teams.map((t) => [t.id, t.logoUrl])),
    slugs: Object.fromEntries(teams.map((t) => [t.id, t.slug])),
    now,
  };
}

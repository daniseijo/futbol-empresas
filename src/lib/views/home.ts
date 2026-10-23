import { cacheLife } from "next/cache";
import { siteConfig } from "@/config/site";
import { addDays, dayKey, nowInMadrid } from "@/lib/dates";
import {
  getCurrentSeason,
  getLatestNews,
  getLeagues,
  getPlayers,
  getSeasonMatches,
  getSeasonTournaments,
  getSquad,
  getTeam,
  getTeams,
  type NewsItem,
} from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, Season, StandingRow } from "@/lib/sportspress/types";
import { getVenue } from "@/lib/sportspress/venues";
import { computeStandings } from "@/lib/standings";
import { buildTeamContext, type TeamContext } from "./team-context";

export interface DayMatch {
  id: number;
  time: string;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  venue: string;
  label: string | null;
  isFocus: boolean;
}

export interface CompetitionCard {
  id: number;
  name: string;
  href: string;
  status: "live" | "starting" | "upcoming" | "finished";
  description: string;
  played: number;
  total: number;
}

export interface GroupLeader {
  groupId: number;
  groupName: string;
  href: string;
  leader: string;
  points: number;
  isFocusGroup: boolean;
  focusPosition: number | null;
}

export interface ScorerRow {
  playerId: number;
  name: string;
  team: string;
  goals: number;
  photoUrl: string | null;
}

export interface BigWin {
  id: number;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

export interface FocusBlock extends TeamContext {
  topScorer: { name: string; goals: number } | null;
  mostValuable: { name: string; value: number } | null;
  zone: StandingRow[];
}

export interface HomeData {
  now: string;
  season: Season;
  day: { date: string; isToday: boolean; matches: DayMatch[]; venues: number; labels: string[] };
  focus: FocusBlock | null;
  mainCompetition: { name: string; teams: number; groups: number; played: number; goals: number; venues: number };
  competitions: CompetitionCard[];
  groupsPhase: string;
  groupLeaders: GroupLeader[];
  scorers: ScorerRow[];
  week: { matches: number; goals: number; from: string; to: string; bigWins: BigWin[] };
  news: NewsItem | null;
}

function pickDay(matches: Match[], today: string): { date: string; isToday: boolean } | null {
  if (matches.some((m) => dayKey(m.date) === today)) return { date: today, isToday: true };
  const next = matches.find((m) => dayKey(m.date) > today);
  if (next) return { date: dayKey(next.date), isToday: false };
  const last = [...matches].reverse().find((m) => dayKey(m.date) < today);
  return last ? { date: dayKey(last.date), isToday: false } : null;
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true });
}

export async function getHomeData(): Promise<HomeData> {
  "use cache";
  cacheLife("results");

  const now = nowInMadrid();
  const today = dayKey(now);
  const season = await getCurrentSeason();
  const [matches, leagues, teams, tournaments, news, focusTeam] = await Promise.all([
    getSeasonMatches(season.id),
    getLeagues(),
    getTeams(),
    getSeasonTournaments(season.id),
    getLatestNews(1),
    getTeam(siteConfig.focusTeamSlug),
  ]);
  const tree = new LeagueTree(leagues);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));

  // Main competition: the one with the most matches this season.
  const byCompetition = new Map<number, Match[]>();
  for (const match of matches) {
    const id = match.competitionId;
    if (!id) continue;
    byCompetition.set(id, [...(byCompetition.get(id) ?? []), match]);
  }
  const mainId = [...byCompetition.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  const mainMatches = mainId ? (byCompetition.get(mainId) ?? []) : [];

  // Focus team (Embat by default).
  let focus: FocusBlock | null = null;
  if (focusTeam) {
    const context = buildTeamContext(focusTeam.id, matches, tree, now);
    const squad = await getSquad(focusTeam.id);
    const topScorer = [...squad].sort((a, b) => b.goals - a.goals)[0];
    const mostValuable = [...squad].sort((a, b) => b.marketValue - a.marketValue)[0];
    const index = context.standings.findIndex((row) => row.teamId === focusTeam.id);
    const start = Math.max(0, Math.min(index - 2, context.standings.length - 4));
    focus = {
      ...context,
      topScorer: topScorer && topScorer.goals > 0 ? { name: topScorer.name, goals: topScorer.goals } : null,
      mostValuable: mostValuable ? { name: mostValuable.name, value: mostValuable.marketValue } : null,
      zone: index >= 0 ? context.standings.slice(start, start + 4) : [],
    };
  }

  // Matches of the day (today or the next date with matches).
  const picked = pickDay(matches, today);
  const dayMatches = picked ? matches.filter((m) => dayKey(m.date) === picked.date) : [];
  const labels = new Set<string>();
  const day = {
    date: picked?.date ?? today,
    isToday: picked?.isToday ?? false,
    venues: new Set(dayMatches.map((m) => m.venueId)).size,
    labels: [] as string[],
    matches: dayMatches.map((m) => {
      const deepest = tree.deepest(m.leagueIds);
      const competition = deepest ? tree.competitionOf(deepest.id) : undefined;
      const label = competition ? `${competition.name}${m.round ? ` · J${m.round}` : ""}` : null;
      if (label) labels.add(label);
      return {
        id: m.id,
        time: m.date.slice(11, 16),
        home: m.homeName,
        away: m.awayName,
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        venue: getVenue(m.venueId)?.name ?? "",
        label: competition && competition.id !== mainId ? competition.name : null,
        isFocus: focusTeam ? m.homeId === focusTeam.id || m.awayId === focusTeam.id : false,
      };
    }),
  };
  day.labels = [...labels];

  // The season's competitions.
  const winners = new Map<number, string[]>();
  for (const t of tournaments) {
    if (!t.competitionId || !t.winnerId) continue;
    const division = t.title.split(/\s[–-]\s/).pop() ?? t.title;
    const label = `${teamName.get(t.winnerId) ?? "?"} (${division.replace(/ Divisi[oó]n$/i, "")})`;
    winners.set(t.competitionId, [...(winners.get(t.competitionId) ?? []), label]);
  }
  const roots = leagues.filter((l) => l.parentId === null);
  const competitions: CompetitionCard[] = roots.map((root) => {
    const list = byCompetition.get(root.id) ?? [];
    const played = list.filter((m) => m.played).length;
    const teamsInComp = new Set(list.flatMap((m) => [m.homeId, m.awayId])).size;
    const groups = new Set(list.map((m) => tree.deepest(m.leagueIds)?.id)).size;
    const champions = winners.get(root.id);
    let status: CompetitionCard["status"] = "upcoming";
    let description = "Todavía no hay partidos esta temporada.";
    if (list.length > 0 && played === list.length && list.every((m) => dayKey(m.date) < today)) {
      status = "finished";
      description = champions ? `Campeones: ${champions.join(", ")}.` : `${played} partidos jugados.`;
    } else if (list.length > 0) {
      status = played / list.length < 0.25 ? "starting" : "live";
      description = `${teamsInComp} equipos${groups > 1 ? ` en ${groups} grupos` : ""}.`;
    }
    return { id: root.id, name: root.name, href: tree.href(root.id), status, description, played, total: list.length };
  });
  const order = { live: 0, starting: 1, upcoming: 2, finished: 3 };
  competitions.sort((a, b) => order[a.status] - order[b.status] || b.total - a.total);

  // Group leaders of the main competition's current phase.
  const lastPlayed = [...mainMatches].reverse().find((m) => m.played);
  const phase = lastPlayed ? tree.path(tree.deepest(lastPlayed.leagueIds)!.id)[1] : undefined;
  const groupMatches = new Map<number, Match[]>();
  for (const match of mainMatches) {
    const deepest = tree.deepest(match.leagueIds);
    if (!deepest || (phase && tree.path(deepest.id)[1]?.id !== phase.id)) continue;
    groupMatches.set(deepest.id, [...(groupMatches.get(deepest.id) ?? []), match]);
  }
  const groupLeaders: GroupLeader[] = [];
  for (const [groupId, list] of groupMatches) {
    const standings = computeStandings(list);
    const leader = standings[0];
    if (!leader || leader.played === 0) continue;
    const focusRow = focusTeam ? standings.find((r) => r.teamId === focusTeam.id) : undefined;
    groupLeaders.push({
      groupId,
      groupName: tree.name(groupId),
      href: tree.href(groupId),
      leader: leader.name,
      points: leader.points,
      isFocusGroup: Boolean(focusRow),
      focusPosition: focusRow?.position ?? null,
    });
  }
  groupLeaders.sort((a, b) => naturalCompare(a.groupName, b.groupName));

  // Top scorers of the main competition (the Corporate Cup and other cups do not count).
  const goals = new Map<number, { goals: number; teamId: number }>();
  for (const match of mainMatches) {
    for (const scorer of match.scorers) {
      if (scorer.goals === 0) continue;
      const entry = goals.get(scorer.playerId) ?? { goals: 0, teamId: scorer.teamId };
      entry.goals += scorer.goals;
      goals.set(scorer.playerId, entry);
    }
  }
  const top = [...goals.entries()].sort((a, b) => b[1].goals - a[1].goals).slice(0, 6);
  const players = await getPlayers(top.map(([id]) => id));
  const scorers = top.map(([playerId, entry]) => ({
    playerId,
    name: players[playerId]?.name ?? "Jugador",
    team: teamName.get(entry.teamId) ?? "",
    goals: entry.goals,
    photoUrl: players[playerId]?.photoUrl ?? null,
  }));

  // Summary of the last 7 days.
  const from = addDays(today, -7);
  const weekMatches = matches.filter((m) => m.played && dayKey(m.date) >= from && dayKey(m.date) <= today);
  const bigWins = [...weekMatches]
    .sort((a, b) => Math.abs(b.homeGoals! - b.awayGoals!) - Math.abs(a.homeGoals! - a.awayGoals!))
    .slice(0, 4)
    .map((m) => ({ id: m.id, home: m.homeName, away: m.awayName, homeGoals: m.homeGoals!, awayGoals: m.awayGoals! }));

  const mainPlayed = mainMatches.filter((m) => m.played);
  return {
    now,
    season,
    day,
    focus,
    mainCompetition: {
      name: mainId ? tree.name(mainId) : "",
      teams: new Set(mainMatches.flatMap((m) => [m.homeId, m.awayId])).size,
      groups: groupMatches.size,
      played: mainPlayed.length,
      goals: mainPlayed.reduce((sum, m) => sum + m.homeGoals! + m.awayGoals!, 0),
      venues: new Set(matches.map((m) => m.venueId).filter(Boolean)).size,
    },
    competitions,
    groupsPhase: phase?.name ?? "",
    groupLeaders,
    scorers,
    week: {
      matches: weekMatches.length,
      goals: weekMatches.reduce((sum, m) => sum + m.homeGoals! + m.awayGoals!, 0),
      from,
      to: today,
      bigWins,
    },
    news: news[0] ?? null,
  };
}

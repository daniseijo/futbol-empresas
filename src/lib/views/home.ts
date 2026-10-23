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
import { getFeatured, type FeaturedTeam } from "./featured";
import { buildTeamContext } from "./team-context";

export interface DayMatch {
  id: number;
  time: string;
  homeId: number;
  awayId: number;
  home: string;
  away: string;
  homePosition: number | null;
  awayPosition: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  venue: string;
  /** Group and round, "Grupo 7 · J4", or the competition outside the main one. */
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

export type FocusBlock = FeaturedTeam;

export interface HomeData {
  now: string;
  season: Season;
  day: { date: string; when: "today" | "upcoming" | "past"; matches: DayMatch[]; venues: number; competition: string | null };
  focus: FocusBlock | null;
  mainCompetition: { id: number | null; name: string; played: number; goals: number };
  competitions: CompetitionCard[];
  groupsPhase: string;
  groupLeaders: GroupLeader[];
  scorers: ScorerRow[];
  week: { matches: number; goals: number; from: string; to: string; bigWins: BigWin[] };
  news: NewsItem | null;
}

function pickDay(matches: Match[], today: string): { date: string; when: HomeData["day"]["when"] } | null {
  if (matches.some((m) => dayKey(m.date) === today)) return { date: today, when: "today" };
  const next = matches.find((m) => dayKey(m.date) > today);
  if (next) return { date: dayKey(next.date), when: "upcoming" };
  const last = [...matches].reverse().find((m) => dayKey(m.date) < today);
  return last ? { date: dayKey(last.date), when: "past" } : null;
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
    focus = { ...context, ...(await getFeatured(context, matches, squad, now)) };
  }

  // Matches of the day (today or the next date with matches).
  const picked = pickDay(matches, today);
  const dayMatches = picked ? matches.filter((m) => dayKey(m.date) === picked.date) : [];
  const groupStandings = new Map<number, StandingRow[]>();
  const positionIn = (groupId: number | null, teamId: number) => {
    if (!groupId) return null;
    if (!groupStandings.has(groupId)) groupStandings.set(groupId, computeStandings(matches.filter((m) => m.groupId === groupId)));
    return groupStandings.get(groupId)!.find((r) => r.teamId === teamId)?.position ?? null;
  };
  const dayCompetitions = new Set(dayMatches.map((m) => m.competitionId));
  const onlyCompetition = dayCompetitions.size === 1 ? [...dayCompetitions][0] : null;
  const day: HomeData["day"] = {
    date: picked?.date ?? today,
    when: picked?.when ?? "upcoming",
    venues: new Set(dayMatches.map((m) => m.venueId)).size,
    competition: onlyCompetition ? tree.name(onlyCompetition) : null,
    matches: dayMatches.map((m) => {
      const round = m.round ? ` · J${m.round}` : "";
      const where =
        m.competitionId && m.competitionId !== mainId
          ? tree.name(m.competitionId)
          : m.groupId && m.groupId !== m.competitionId
            ? tree.name(m.groupId)
            : null;
      return {
        id: m.id,
        time: m.date.slice(11, 16),
        homeId: m.homeId,
        awayId: m.awayId,
        home: m.homeName,
        away: m.awayName,
        homePosition: positionIn(m.groupId, m.homeId),
        awayPosition: positionIn(m.groupId, m.awayId),
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        venue: getVenue(m.venueId)?.name ?? "",
        label: where ? `${where}${round}` : null,
        isFocus: focusTeam ? m.homeId === focusTeam.id || m.awayId === focusTeam.id : false,
      };
    }),
  };

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
      id: mainId ?? null,
      name: mainId ? tree.name(mainId) : "",
      played: mainPlayed.length,
      goals: mainPlayed.reduce((sum, m) => sum + m.homeGoals! + m.awayGoals!, 0),
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

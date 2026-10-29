import { cacheLife } from "next/cache";
import { siteConfig } from "@/config/site";
import { addDays, dayKey, nowInMadrid, resultOverdue } from "@/lib/dates";
import { getCurrentSeason, getLeagues, getSeasonMatches, getTeam } from "@/lib/data";
import { championsStage } from "@/lib/sportspress/champions";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, StandingRow } from "@/lib/sportspress/types";
import { getVenue } from "@/lib/sportspress/venues";
import { computeStandings } from "@/lib/standings";

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
  venueId: number | null;
  venue: string;
  /** Group and round, "Grupo 7 · J4", or the competition outside the main one; the sector in the Champions. */
  label: string | null;
  /** A Champions match, which the card draws in navy. */
  champions: boolean;
  isFocus: boolean;
  /** Its time has passed and the league has not published a score. */
  noResult: boolean;
}

export interface Day {
  date: string;
  matches: DayMatch[];
  venues: number;
  /** The competition's name, only when every match of the day shares it. */
  competition: string | null;
}

export interface DayPageData {
  now: string;
  day: Day;
  /** The previous and next dates with matches this season. */
  previous: string | null;
  next: string | null;
}

/** The competition with the most matches this season. */
export function mainCompetitionId(matches: Match[]): number | null {
  const counts = new Map<number, number>();
  for (const match of matches) {
    if (match.competitionId) counts.set(match.competitionId, (counts.get(match.competitionId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Today if it has matches, otherwise the next date with matches, otherwise the last one. */
export function pickDay(matches: Match[], today: string): { date: string; when: "today" | "upcoming" | "past" } | null {
  if (matches.some((m) => dayKey(m.date) === today)) return { date: today, when: "today" };
  const next = matches.find((m) => dayKey(m.date) > today);
  if (next) return { date: dayKey(next.date), when: "upcoming" };
  const last = [...matches].reverse().find((m) => dayKey(m.date) < today);
  return last ? { date: dayKey(last.date), when: "past" } : null;
}

/** The matches of one date, sorted by kick-off time and then venue. `now` tells past matches without a score apart. */
export function buildDay(matches: Match[], tree: LeagueTree, date: string, focusTeamId: number | null, mainId: number | null, now = ""): Day {
  const dayMatches = matches.filter((m) => dayKey(m.date) === date);
  const groupStandings = new Map<number, StandingRow[]>();
  const positionIn = (groupId: number | null, teamId: number) => {
    if (!groupId) return null;
    if (!groupStandings.has(groupId)) groupStandings.set(groupId, computeStandings(matches.filter((m) => m.groupId === groupId)));
    return groupStandings.get(groupId)!.find((r) => r.teamId === teamId)?.position ?? null;
  };
  const competitions = new Set(dayMatches.map((m) => m.competitionId));
  const onlyCompetition = competitions.size === 1 ? [...competitions][0] : null;
  const rows = dayMatches.map((m): DayMatch => {
    const round = m.round ? ` · J${m.round}` : "";
    // "Champions" is the card's own label; the sector says which one.
    const stage = championsStage(m, tree);
    const where = stage
      ? stage.sector
      : m.competitionId && m.competitionId !== mainId
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
      venueId: getVenue(m.venueId)?.id ?? null,
      venue: getVenue(m.venueId)?.name ?? "",
      label: where ? `${where}${round}` : null,
      champions: stage !== null,
      isFocus: focusTeamId !== null && (m.homeId === focusTeamId || m.awayId === focusTeamId),
      noResult: !m.played && resultOverdue(m.date, now),
    };
  });
  rows.sort((a, b) => a.time.localeCompare(b.time) || a.venue.localeCompare(b.venue, "es"));
  return {
    date,
    matches: rows,
    venues: new Set(dayMatches.map((m) => m.venueId)).size,
    competition: onlyCompetition ? tree.name(onlyCompetition) : null,
  };
}

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && addDays(date, 0) === date;
}

/** Every match of one date of the current season, or null if the date is malformed or has none. */
export async function getDayPageData(date: string): Promise<DayPageData | null> {
  "use cache";
  cacheLife("results");

  if (!isValidDate(date)) return null;
  const season = await getCurrentSeason();
  const [matches, leagues, focusTeam] = await Promise.all([
    getSeasonMatches(season.id),
    getLeagues(),
    getTeam(siteConfig.focusTeamSlug),
  ]);
  const day = buildDay(matches, new LeagueTree(leagues), date, focusTeam?.id ?? null, mainCompetitionId(matches), nowInMadrid());
  if (day.matches.length === 0) return null;

  const dates = [...new Set(matches.map((m) => dayKey(m.date)))].sort();
  return {
    now: nowInMadrid(),
    day,
    previous: dates.findLast((d) => d < date) ?? null,
    next: dates.find((d) => d > date) ?? null,
  };
}

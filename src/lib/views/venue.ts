import { cacheLife } from "next/cache";
import { siteConfig } from "@/config/site";
import { dayKey, nowInMadrid } from "@/lib/dates";
import { getCurrentSeason, getLeagues, getSeasonMatches, getTeam, getTeams } from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, Venue } from "@/lib/sportspress/types";
import { getVenue, getVenues } from "@/lib/sportspress/venues";
import { buildDay, mainCompetitionId, pickDay, type Day } from "./day";

/** Results shown under "Últimos resultados"; the rest of the season is on the teams' pages. */
const RECENT_RESULTS = 12;
const TOP_TEAMS = 6;

export interface VenueTeam {
  id: number;
  name: string;
  slug: string | null;
  matches: number;
}

export interface VenuePageData {
  now: string;
  venue: Venue;
  season: string;
  /** Today's matches at the venue, or those of its next (or last) date with matches. */
  day: (Day & { when: "today" | "upcoming" | "past" }) | null;
  /** The season's other matches at the venue: upcoming in date order, results newest first. */
  upcoming: Match[];
  recent: Match[];
  total: number;
  teams: VenueTeam[];
}

export interface VenueSummary {
  venue: Venue;
  matches: number;
}

/** The teams with the most matches at the venue, most first, then by name. */
export function topTeams(matches: Match[], count: number): { id: number; name: string; matches: number }[] {
  const teams = new Map<number, { id: number; name: string; matches: number }>();
  for (const m of matches) {
    for (const [id, name] of [
      [m.homeId, m.homeName],
      [m.awayId, m.awayName],
    ] as const) {
      const team = teams.get(id) ?? { id, name, matches: 0 };
      team.matches++;
      teams.set(id, team);
    }
  }
  return [...teams.values()].sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name, "es")).slice(0, count);
}

/** A venue's page: its next date with matches, the rest of the season there and who plays there most. */
export async function getVenuePageData(id: number): Promise<VenuePageData | null> {
  "use cache";
  cacheLife("results");

  const venue = getVenue(id);
  if (!venue) return null;
  const season = await getCurrentSeason();
  const [matches, leagues, focusTeam, teams] = await Promise.all([
    getSeasonMatches(season.id),
    getLeagues(),
    getTeam(siteConfig.focusTeamSlug),
    getTeams(),
  ]);
  const now = nowInMadrid();
  const here = matches.filter((m) => m.venueId === id);
  const picked = pickDay(here, dayKey(now));
  let day: VenuePageData["day"] = null;
  if (picked) {
    // Built from the whole season so the positions in each group are right.
    const all = buildDay(matches, new LeagueTree(leagues), picked.date, focusTeam?.id ?? null, mainCompetitionId(matches));
    const dayMatches = all.matches.filter((m) => m.venueId === id);
    day = { ...all, matches: dayMatches, venues: 1, when: picked.when };
  }
  const rest = here.filter((m) => dayKey(m.date) !== picked?.date);
  const slugs = new Map(teams.map((t) => [t.id, t.slug]));
  return {
    now,
    venue,
    season: season.name,
    day,
    upcoming: rest.filter((m) => !m.played && m.date >= now),
    recent: rest
      .filter((m) => m.played)
      .reverse()
      .slice(0, RECENT_RESULTS),
    total: here.length,
    teams: topTeams(here, TOP_TEAMS).map((t) => ({ ...t, slug: slugs.get(t.id) ?? null })),
  };
}

/** Every venue with its number of matches this season. */
export async function getVenuesIndex(): Promise<{ season: string; venues: VenueSummary[] }> {
  "use cache";
  cacheLife("results");

  const season = await getCurrentSeason();
  const matches = await getSeasonMatches(season.id);
  const counts = new Map<number, number>();
  for (const m of matches) if (m.venueId) counts.set(m.venueId, (counts.get(m.venueId) ?? 0) + 1);
  return { season: season.name, venues: getVenues().map((venue) => ({ venue, matches: counts.get(venue.id) ?? 0 })) };
}

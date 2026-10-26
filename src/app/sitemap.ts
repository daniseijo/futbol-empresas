import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getCurrentSeason, getGroupSeasons, getLeagues, getSearchIndex, getSeasonMatches, getTeams } from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import { getVenues } from "@/lib/sportspress/venues";

/**
 * Every page worth finding: competitions and matches of the current season,
 * every team and venue, and the players with a name (private profiles have
 * none, and their page shows only a shirt number). ~10,000 URLs, well under
 * the 50,000 a single sitemap may hold.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [season, leagues, groupSeasons, teams, index] = await Promise.all([
    getCurrentSeason(),
    getLeagues(),
    getGroupSeasons(),
    getTeams(),
    getSearchIndex(),
  ]);
  const matches = await getSeasonMatches(season.id);
  const tree = new LeagueTree(leagues);
  // A group played this season, and every competition and phase above it.
  const competitions = new Set(
    groupSeasons.filter((row) => row.seasonId === season.id).flatMap((row) => tree.path(row.groupId).map((league) => tree.href(league.id))),
  );

  const paths = [
    "/",
    "/campos",
    "/slack",
    ...competitions,
    ...teams.map((team) => `/equipos/${team.slug}`),
    ...getVenues().map((venue) => `/campos/${venue.id}`),
    ...matches.map((match) => `/partidos/${match.id}`),
    ...index.players.map(([id]) => `/jugadores/${id}`),
  ];
  return paths.map((path) => ({ url: new URL(path, siteConfig.url).href }));
}

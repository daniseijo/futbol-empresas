import { cacheLife } from "next/cache";
import { dayKey, nowInMadrid } from "@/lib/dates";
import { getCurrentSeason, getGroupMatches, getLeagues, getSeasonMatches, getSeasons, getSquad, getTeam, getTeams } from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, Season, SquadPlayer, Team } from "@/lib/sportspress/types";
import { outcomeFor } from "@/lib/standings";
import { getFeatured, type Featured } from "./featured";
import { buildTeamContext, involves, type TeamContext } from "./team-context";

export type SeasonEntry =
  | { kind: "match"; match: Match; hasVideo: boolean }
  | { kind: "rest"; round: number; date: string };

export interface Photo {
  url: string;
  caption: string;
}

export interface TeamPageData extends TeamContext, Featured {
  team: Team;
  season: Season;
  now: string;
  /** "Primera temporada en la liga" or "En la liga desde 22/23". */
  seniority: string;
  logos: Record<number, string | null>;
  slugs: Record<number, string>;
  entries: SeasonEntry[];
  squad: SquadPlayer[];
  photos: Photo[];
  heroPhoto: Photo | null;
  /** The most recent played match with video highlights. */
  latestVideo: { matchId: number; id: string; title: string } | null;
  balance: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number };
  competitions: string[];
}

function score(match: Match) {
  return `${match.homeName} ${match.homeGoals}–${match.awayGoals} ${match.awayName}`;
}

/** Everything a team's tabs need (header, overview, matches, standings and squad). */
export async function getTeamPageData(slug: string): Promise<TeamPageData | null> {
  "use cache";
  cacheLife("results");

  const [team, season, seasons, leagues, teams] = await Promise.all([
    getTeam(slug),
    getCurrentSeason(),
    getSeasons(),
    getLeagues(),
    getTeams(),
  ]);
  if (!team) return null;
  const now = nowInMadrid();
  const tree = new LeagueTree(leagues);
  // The group on the team profile is usually the current one: fetch it now, in parallel.
  const enrolledGroup = tree.deepest(team.leagueIds)?.id ?? null;
  const [seasonMatches, squad, enrolledMatches] = await Promise.all([
    getSeasonMatches(season.id),
    getSquad(team.id),
    enrolledGroup ? getGroupMatches(enrolledGroup, season.id) : Promise.resolve([]),
  ]);
  const context = buildTeamContext(team.id, seasonMatches, tree, now);

  // Photos and videos of the group matches the team played.
  const groupMatches = !context.group
    ? []
    : context.group.id === enrolledGroup
      ? enrolledMatches
      : await getGroupMatches(context.group.id, season.id);
  const ownPlayed = groupMatches.filter((m) => involves(m, team.id) && m.played).reverse();
  const photos: Photo[] = ownPlayed.flatMap((m) =>
    m.photos.map((url) => ({ url, caption: `${m.round ? `Jornada ${m.round} · ` : ""}${score(m)}` })),
  );
  const withVideo = ownPlayed.find((m) => m.video);
  const latestVideo = withVideo?.video
    ? { matchId: withVideo.id, id: withVideo.video.id, title: withVideo.video.title ?? score(withVideo) }
    : null;
  const videoIds = new Set(groupMatches.filter((m) => m.video).map((m) => m.id));

  // Bye weeks: group rounds in which the team does not play. A match of its own on that day counts as
  // playing even when the API left its round empty, or the list would show a bye next to the match.
  const entries: SeasonEntry[] = context.matches.map((match) => ({ kind: "match", match, hasVideo: videoIds.has(match.id) }));
  const ownRounds = new Set(context.matches.map((m) => m.round));
  const ownDays = new Set(context.matches.map((m) => dayKey(m.date)));
  const roundDates = new Map<number, string>();
  for (const m of groupMatches) {
    if (m.round && !roundDates.has(m.round)) roundDates.set(m.round, m.date);
  }
  for (const [round, date] of roundDates) {
    if (!ownRounds.has(round) && !ownDays.has(dayKey(date))) entries.push({ kind: "rest", round, date });
  }
  entries.sort((a, b) => {
    const dateA = a.kind === "match" ? a.match.date : a.date;
    const dateB = b.kind === "match" ? b.match.date : b.date;
    return dateA.localeCompare(dateB);
  });

  const balance = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const match of context.matches) {
    const outcome = outcomeFor(match, team.id);
    if (!outcome) continue;
    const isHome = match.homeId === team.id;
    balance.played += 1;
    balance.goalsFor += (isHome ? match.homeGoals : match.awayGoals) ?? 0;
    balance.goalsAgainst += (isHome ? match.awayGoals : match.homeGoals) ?? 0;
    if (outcome === "V") balance.won += 1;
    else if (outcome === "E") balance.drawn += 1;
    else balance.lost += 1;
  }

  const competitions = [
    ...new Set(
      context.matches
        .map((m) => tree.deepest(m.leagueIds))
        .filter((league) => league !== undefined)
        .map((league) => tree.path(league.id)[0].name),
    ),
  ];

  // Seniority: seasons it is registered in (the API lists them on the team profile).
  const ownSeasons = seasons.filter((s) => team.seasonIds.includes(s.id));
  const seniority =
    ownSeasons.length <= 1 || ownSeasons[0].id === season.id ? "Primera temporada en la liga" : `En la liga desde la ${ownSeasons[0].name}`;

  const logos = Object.fromEntries(teams.map((t) => [t.id, t.logoUrl]));
  const slugs = Object.fromEntries(teams.map((t) => [t.id, t.slug]));
  const heroPhoto = team.photoUrl ? { url: team.photoUrl, caption: "" } : (photos[0] ?? null);
  const featured = await getFeatured(context, seasonMatches, squad, now);

  return {
    ...context,
    ...featured,
    team,
    season,
    now,
    seniority,
    logos,
    slugs,
    entries,
    squad,
    photos,
    heroPhoto,
    latestVideo,
    balance,
    competitions,
  };
}

/** Where the team plays this season, for link previews: "Liga Apertura 26/27 · Grupo 20". */
export function teamSummary(data: TeamPageData): string {
  const { group, season } = data;
  if (!group) return `Temporada ${season.name}`;
  const competition = `${group.competition} ${season.name}`;
  return group.name === group.competition ? competition : `${competition} · ${group.name}`;
}

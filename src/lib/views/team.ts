import { cacheLife } from "next/cache";
import { nowInMadrid } from "@/lib/dates";
import { getCurrentSeason, getGroupMatches, getLeagues, getSeasonMatches, getSeasons, getSquad, getTeam, getTeams } from "@/lib/data";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, Season, SquadPlayer, Team } from "@/lib/sportspress/types";
import { outcomeFor } from "@/lib/standings";
import { buildTeamContext, involves, type TeamContext } from "./team-context";

export type SeasonEntry =
  | { kind: "match"; match: Match; hasVideo: boolean }
  | { kind: "rest"; round: number; date: string };

export interface Photo {
  url: string;
  caption: string;
}

export interface TeamPageData extends TeamContext {
  team: Team;
  season: Season;
  now: string;
  /** «Primera temporada en la liga» o «En la liga desde 22/23». */
  seniority: string;
  logos: Record<number, string | null>;
  slugs: Record<number, string>;
  entries: SeasonEntry[];
  squad: SquadPlayer[];
  photos: Photo[];
  heroPhoto: Photo | null;
  /** El partido jugado más reciente con resumen en vídeo. */
  latestVideo: { matchId: number; id: string; title: string } | null;
  balance: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number };
  competitions: string[];
}

function score(match: Match) {
  return `${match.homeName} ${match.homeGoals}–${match.awayGoals} ${match.awayName}`;
}

/** Todo lo que necesitan las pestañas de un equipo (cabecera, resumen, partidos, clasificación y plantilla). */
export async function getTeamPageData(slug: string): Promise<TeamPageData | null> {
  "use cache";
  cacheLife("resultados");

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
  // El grupo inscrito en la ficha suele ser el actual: lo pedimos ya, en paralelo.
  const enrolledGroup = tree.deepest(team.leagueIds)?.id ?? null;
  const [seasonMatches, squad, enrolledMatches] = await Promise.all([
    getSeasonMatches(season.id),
    getSquad(team.id),
    enrolledGroup ? getGroupMatches(enrolledGroup, season.id) : Promise.resolve([]),
  ]);
  const context = buildTeamContext(team.id, seasonMatches, tree, now);

  // Fotos y vídeos de los partidos del grupo en los que ha jugado el equipo.
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

  // Jornadas de descanso: rondas del grupo en las que el equipo no juega.
  const entries: SeasonEntry[] = context.matches.map((match) => ({ kind: "match", match, hasVideo: videoIds.has(match.id) }));
  const ownRounds = new Set(context.matches.map((m) => m.round));
  const roundDates = new Map<number, string>();
  for (const m of groupMatches) {
    if (m.round && !roundDates.has(m.round)) roundDates.set(m.round, m.date);
  }
  for (const [round, date] of roundDates) {
    if (!ownRounds.has(round)) entries.push({ kind: "rest", round, date });
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

  // Antigüedad: temporadas en las que está inscrito (la API las da en la ficha del equipo).
  const ownSeasons = seasons.filter((s) => team.seasonIds.includes(s.id));
  const seniority =
    ownSeasons.length <= 1 || ownSeasons[0].id === season.id ? "Primera temporada en la liga" : `En la liga desde la ${ownSeasons[0].name}`;

  const logos = Object.fromEntries(teams.map((t) => [t.id, t.logoUrl]));
  const slugs = Object.fromEntries(teams.map((t) => [t.id, t.slug]));
  const heroPhoto = team.photoUrl ? { url: team.photoUrl, caption: "" } : (photos[0] ?? null);

  return {
    ...context,
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

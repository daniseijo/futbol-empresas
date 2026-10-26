import { cacheLife } from "next/cache";
import { siteConfig } from "@/config/site";
import { buildKnockout } from "@/lib/bracket";
import { dayKey, formatLongDate, nowInMadrid } from "@/lib/dates";
import {
  getCurrentSeason,
  getGroupSeasons,
  getLeagues,
  getPlayers,
  getSeasonMatches,
  getSeasons,
  getSeasonTournaments,
  getSheetTotals,
  getTeams,
} from "@/lib/data";
import { playerDisplayName } from "@/lib/players";
import { expectedTotal } from "@/lib/expected-matches";
import { LeagueTree } from "@/lib/sportspress/leagues";
import type { Match, Season, StandingRow } from "@/lib/sportspress/types";
import { computeStandings } from "@/lib/standings";
import { expectedRulesFor } from "./expected-rules";
import { buildIdealSeven, type IdealSevenData } from "./ideal";
import { expectedBracketSize } from "./knockout";

export interface Crumb {
  name: string;
  href: string;
}

export interface SeasonLink {
  name: string;
  href: string;
}

/** A group, phase or division under the node, with its leader. */
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

/** A round (or, in cups without rounds, a match day). */
export interface RoundEntry {
  key: string;
  label: string;
  date: string;
  matches: Match[];
  resting: string[];
}

/** A knockout tie as the bracket draws it. */
export interface BracketTie {
  id: number;
  date: string;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  played: boolean;
  winnerId: number | null;
}

export interface BracketData {
  /** The division, from the league's record of its champion ("Primera División"), or "Cuadro 2". */
  name: string | null;
  championId: number | null;
  rounds: { name: string; ties: BracketTie[] }[];
  /** The round shown first on phones: the first with a tie to play or, if none, the final. */
  currentRound: number;
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
  /** The matches are a cup's knockout (a cup in progress, or those outside its brackets): no standings. */
  knockout: boolean;
  /**
   * The round shown by default: the first one starting today or later or, if
   * none is left, the last one. It goes by the day of its first match, so a
   * postponed match does not leave the view stuck on an old round.
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
  /** Knockout brackets inferred from the node's own matches (cups). */
  brackets: BracketData[];
  /**
   * Standings and rounds: only if the node has its own matches (a group, a cup).
   * With brackets, only the matches outside them, and no standings.
   */
  group: GroupData | null;
  totals: { teams: number; played: number; total: number; goals: number };
  scorers: PlayerTally[];
  cracks: PlayerTally[];
  /** The best goalkeeper, two defenders, two midfielders and two forwards of the node's matches. */
  ideal: IdealSevenData;
  focusTeamId: number | null;
  logos: Record<number, string | null>;
  slugs: Record<number, string>;
  now: string;
}

const TALLY_SIZE = 8;

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true });
}

function buildRounds(matches: Match[], standings: StandingRow[], now: string): RoundEntry[] {
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
        label: round ? `Jornada ${round}` : formatLongDate(list[0].date, now),
        date: list[0].date,
        matches: list,
        resting: round ? standings.filter((row) => !playing.has(row.teamId)).map((row) => row.name) : [],
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Goals or Crack awards per player, highest first. */
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
 * Page of a competition, phase or group in one season. `segments` is the URL
 * path and `seasonParam` the requested season ("25-26"); without it, the
 * current one or, if the node was not played this year, the last one it was.
 */
export async function getCompetitionPageData(segments: string[], seasonParam: string | null): Promise<CompetitionPageData | null> {
  "use cache";
  cacheLife("results");

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

  // Seasons in which this node or its children had any match.
  const inSubtree = (groupId: number) => tree.path(groupId).some((league) => league.id === node.id);
  const seasonIds = new Set(groupSeasons.filter((row) => inSubtree(row.groupId)).map((row) => row.seasonId));
  const available = seasons.filter((s) => seasonIds.has(s.id));
  const requested = seasonParam ? seasons.find((s) => s.name === seasonParam.replace("-", "/")) : undefined;
  const fallback = available.some((s) => s.id === current.id) ? current : (available[available.length - 1] ?? current);
  const season = requested ?? fallback;
  // The current season has no parameter: it is the default for almost every node.
  const seasonHref = (id: number, s: Season) => tree.href(id, s.id === current.id ? undefined : s.name);

  const now = nowInMadrid();
  const today = dayKey(now);
  const seasonMatches = await getSeasonMatches(season.id);
  const matches = seasonMatches.filter((m) => m.groupId !== null && inSubtree(m.groupId));
  const focusTeamId = teams.find((t) => t.slug === siteConfig.focusTeamSlug)?.id ?? null;
  // Rounds are published a week ahead: this season's totals are estimated; past ones are complete.
  const rules = season.id === current.id ? await expectedRulesFor(season, tree, teams) : null;
  const totalOf = (list: Match[]) => (rules ? expectedTotal(list, rules) : list.length);

  // Children with matches this season, with their leader if they are a group with standings.
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
        total: totalOf(list),
        leader: leader && leader.played > 0 ? { name: leader.name, points: leader.points } : null,
        hasFocusTeam: focusTeamId !== null && teamIds.has(focusTeamId),
      };
    })
    .filter((child) => child.total > 0)
    .sort((a, b) => naturalCompare(a.name, b.name));

  const direct = matches.filter((m) => m.groupId === node.id);
  // Only cups have their own matches in a knockout's shape; groups and leagues fall through to the standings.
  const tournaments = direct.length > 0 ? await getSeasonTournaments(season.id) : [];
  const competitionId = tree.competitionOf(node.id)?.id ?? node.id;
  const recorded = tournaments.filter(
    (t) => t.winnerId !== null && t.winnerId > 0 && (t.competitionId === competitionId || t.competitionId === node.id),
  );
  // A cup in progress is read with the size of last season's brackets.
  const expectedSize = direct.length > 0 && season.id === current.id ? await expectedBracketSize(node.id, season, tree) : undefined;
  const knockout = buildKnockout(direct, { champions: recorded.map((t) => t.winnerId!), now, expectedSize });
  const brackets = knockout.brackets.map((bracket, index): BracketData => {
    const title = recorded.find((t) => t.winnerId === bracket.championId)?.title;
    const firstToPlay = bracket.rounds.findIndex((round) => round.ties.some((tie) => !tie.match.played));
    return {
      name: title?.split(/\s[–-]\s/).pop() ?? (knockout.brackets.length > 1 ? `Cuadro ${index + 1}` : null),
      championId: bracket.championId,
      rounds: bracket.rounds.map((round) => ({
        name: round.name,
        ties: round.ties.map(({ match: m, winnerId }) => ({
          id: m.id,
          date: m.date,
          homeId: m.homeId,
          awayId: m.awayId,
          homeName: m.homeName,
          awayName: m.awayName,
          homeGoals: m.homeGoals,
          awayGoals: m.awayGoals,
          played: m.played,
          winnerId,
        })),
      })),
      currentRound: firstToPlay === -1 ? bracket.rounds.length - 1 : firstToPlay,
    };
  });
  const isKnockout = brackets.length > 0 || knockout.rounds !== null;
  const listed = brackets.length > 0 ? knockout.others : direct;
  let group: GroupData | null = null;
  if (listed.length > 0) {
    const standings = isKnockout ? [] : computeStandings(listed);
    const rounds: RoundEntry[] = knockout.rounds
      ? knockout.rounds.map((round, index) => ({
          key: `ronda-${index + 1}`,
          label: round.name,
          date: round.matches[0].date,
          matches: round.matches,
          resting: [],
        }))
      : buildRounds(listed, standings, now);
    // The first round with a match left to play or, if none is left, the last one.
    const next = knockout.rounds ? rounds.find((r) => r.matches.some((m) => !m.played)) : rounds.find((r) => dayKey(r.date) >= today);
    group = { standings, rounds, knockout: isKnockout, currentRound: (next ?? rounds[rounds.length - 1])?.key ?? null };
  }

  const scorerTotals = top(tally(matches, (s) => s.goals));
  const crackTotals = top(tally(matches, (s) => (s.crack ? 1 : 0)));
  const players = await getPlayers([...new Set([...scorerTotals, ...crackTotals].map(([id]) => id))]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const toTally = ([playerId, entry]: [number, { value: number; teamId: number }]): PlayerTally => ({
    playerId,
    name: playerDisplayName(players[playerId]?.name),
    photoUrl: players[playerId]?.photoUrl ?? null,
    team: teamName.get(entry.teamId) ?? "",
    value: entry.value,
  });

  const groupIds = [...new Set(matches.map((m) => m.groupId!))];
  const ideal = await buildIdealSeven(await getSheetTotals(season.id, { groupIds }), teams);

  const played = matches.filter((m) => m.played);
  return {
    id: node.id,
    name: node.name,
    crumbs: tree.path(node.id).map((league) => ({ name: league.name, href: seasonHref(league.id, season) })),
    season,
    isCurrentSeason: season.id === current.id,
    seasons: available.map((s) => ({ name: s.name, href: seasonHref(node.id, s) })),
    children,
    brackets,
    group,
    totals: {
      teams: new Set(matches.flatMap((m) => [m.homeId, m.awayId])).size,
      played: played.length,
      total: totalOf(matches),
      goals: played.reduce((sum, m) => sum + (m.homeGoals ?? 0) + (m.awayGoals ?? 0), 0),
    },
    scorers: scorerTotals.map(toTally),
    cracks: crackTotals.map(toTally),
    ideal,
    focusTeamId,
    logos: Object.fromEntries(teams.map((t) => [t.id, t.logoUrl])),
    slugs: Object.fromEntries(teams.map((t) => [t.id, t.slug])),
    now,
  };
}

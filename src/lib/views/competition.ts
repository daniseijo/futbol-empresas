import { cacheLife } from "next/cache";
import { siteConfig } from "@/config/site";
import { buildKnockout, isBye } from "@/lib/bracket";
import { dayKey, formatLongDate, formatShortDate, nowInMadrid } from "@/lib/dates";
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
import { CHAMPIONS_PHASES, isChampionsNode, isFaseLiga, type ChampionsPhase } from "@/lib/sportspress/champions";
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

/** A knockout tie as the bracket draws it, or a team going straight to the next round (`bye`). */
export interface BracketTie {
  /** The match's, or minus the team's for a bye. */
  id: number;
  bye: boolean;
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

/** A step on the Champions' road to the final, on the sector page. */
export interface ChampionsStep {
  phase: ChampionsPhase;
  /** "J1 · Mar 3 nov", "Lun 13 abr" or "Por definir". */
  detail: string;
  state: "done" | "current" | "next";
}

/** What a Champions sector's page adds: it is the page of the sector's whole Champions. */
export interface ChampionsSectorData {
  /** The fase liga: its standings and rounds or, in seasons that played it as a knockout, its bracket. */
  faseLiga: { name: string; brackets: BracketData[]; group: GroupData | null } | null;
  steps: ChampionsStep[];
  /** Whether the knockout has started: its tab is the one shown first then. */
  knockoutStarted: boolean;
  /** The focus team's matches in the sector, with their phase ("J1", "Cuartos"), if it plays in it. */
  focusPath: { teamName: string; entries: { label: string; match: Match }[] } | null;
  /** The focus team and the teams it plays in the fase liga, for "Solo mi equipo y sus rivales". */
  rivals: number[];
  /** The season before, for its bracket while this one's is not out. */
  previousSeason: { name: string; href: string } | null;
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
  /** Only on a Champions sector's page. */
  champions: ChampionsSectorData | null;
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
 * A node's own matches: the brackets they form (cups), and the standings and rounds of the rest. With
 * brackets, only the matches outside them are listed, without standings.
 */
async function nodeMatches(
  nodeId: number,
  direct: Match[],
  { season, current, tree, now }: { season: Season; current: Season; tree: LeagueTree; now: string },
): Promise<{ brackets: BracketData[]; group: GroupData | null }> {
  const today = dayKey(now);
  // Only cups have their own matches in a knockout's shape; groups and leagues fall through to the standings.
  const tournaments = direct.length > 0 ? await getSeasonTournaments(season.id) : [];
  const competitionId = tree.competitionOf(nodeId)?.id ?? nodeId;
  const recorded = tournaments.filter(
    (t) => t.winnerId !== null && t.winnerId > 0 && (t.competitionId === competitionId || t.competitionId === nodeId),
  );
  // A cup in progress is read with the size of last season's brackets.
  const expectedSize = direct.length > 0 && season.id === current.id ? await expectedBracketSize(nodeId, season, tree) : undefined;
  const knockout = buildKnockout(direct, { champions: recorded.map((t) => t.winnerId!), now, expectedSize });
  const brackets = knockout.brackets.map((bracket, index): BracketData => {
    const title = recorded.find((t) => t.winnerId === bracket.championId)?.title;
    const firstToPlay = bracket.rounds.findIndex((round) => round.ties.some((tie) => !isBye(tie) && !tie.match.played));
    return {
      name: title?.split(/\s[–-]\s/).pop() ?? (knockout.brackets.length > 1 ? `Cuadro ${index + 1}` : null),
      championId: bracket.championId,
      rounds: bracket.rounds.map((round) => ({
        name: round.name,
        ties: round.ties.map((tie): BracketTie => {
          if (isBye(tie)) {
            const { byeTeamId: id, name } = tie;
            return {
              id: -id,
              bye: true,
              date: "",
              homeId: id,
              awayId: 0,
              homeName: name,
              awayName: "",
              homeGoals: null,
              awayGoals: null,
              played: false,
              winnerId: id,
            };
          }
          const { match: m, winnerId } = tie;
          return {
            id: m.id,
            bye: false,
            date: m.date,
            homeId: m.homeId,
            awayId: m.awayId,
            homeName: m.homeName,
            awayName: m.awayName,
            homeGoals: m.homeGoals,
            awayGoals: m.awayGoals,
            played: m.played,
            winnerId,
          };
        }),
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

  return { brackets, group };
}

/** A knockout round's place on the road to the final. */
const PHASE_OF_ROUND: Record<string, ChampionsPhase> = { Final: "Final", Semifinales: "Semis", Cuartos: "Cuartos" };
const phaseOfRound = (name: string): ChampionsPhase => PHASE_OF_ROUND[name] ?? "Eliminatoria";

/**
 * A Champions sector as the page of its whole Champions: its fase liga (a child node) and its knockout (the
 * sector's own matches, in `brackets` or, in progress, `group`).
 */
async function championsSector(
  sectorId: number,
  matches: Match[],
  brackets: BracketData[],
  knockoutGroup: GroupData | null,
  context: {
    season: Season;
    current: Season;
    tree: LeagueTree;
    now: string;
    focusTeamId: number | null;
    available: Season[];
    seasonHref: (id: number, season: Season) => string;
  },
): Promise<ChampionsSectorData> {
  const { tree, now, focusTeamId, season } = context;
  const node = tree.children(sectorId).find((child) => isFaseLiga(child.name));
  const faseLigaMatches = node ? matches.filter((m) => m.groupId === node.id) : [];
  const faseLiga = node && faseLigaMatches.length > 0 ? { name: node.name, ...(await nodeMatches(node.id, faseLigaMatches, context)) } : null;

  // Each knockout match's phase, from its bracket round or, for a knockout in progress, its listed round.
  const knockoutPhase = new Map<number, ChampionsPhase>();
  for (const bracket of brackets) {
    for (const round of bracket.rounds) for (const tie of round.ties) if (!tie.bye) knockoutPhase.set(tie.id, phaseOfRound(round.name));
  }
  if (knockoutGroup?.knockout) {
    for (const round of knockoutGroup.rounds) for (const m of round.matches) knockoutPhase.set(m.id, phaseOfRound(round.label));
  }
  const knockoutMatches = matches.filter((m) => m.groupId === sectorId);
  const knockoutStarted = knockoutMatches.length > 0;

  // The current phase is the first with a match left to play, or the last one with matches.
  const ligaRounds = faseLiga?.group && !faseLiga.group.knockout ? faseLiga.group.rounds : [];
  const byPhase = new Map<ChampionsPhase, Match[]>([["Fase liga", faseLigaMatches]]);
  for (const m of knockoutMatches) {
    const phase = knockoutPhase.get(m.id) ?? "Eliminatoria";
    byPhase.set(phase, [...(byPhase.get(phase) ?? []), m]);
  }
  const withMatches = CHAMPIONS_PHASES.filter((phase) => (byPhase.get(phase)?.length ?? 0) > 0);
  const current = withMatches.find((phase) => byPhase.get(phase)!.some((m) => !m.played)) ?? withMatches.at(-1) ?? "Fase liga";
  const currentIndex = CHAMPIONS_PHASES.indexOf(current);
  const currentRound = ligaRounds.find((r) => r.key === faseLiga?.group?.currentRound);
  const steps = CHAMPIONS_PHASES.map((phase, index): ChampionsStep => {
    const list = [...(byPhase.get(phase) ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    const detail =
      phase === "Fase liga" && currentRound && index === currentIndex
        ? `J${currentRound.matches[0].round ?? ""} · ${formatShortDate(currentRound.date, now)}`
        : list.length > 0
          ? formatShortDate(list[0].date, now)
          : "Por definir";
    return { phase, detail, state: index < currentIndex ? "done" : index === currentIndex ? "current" : "next" };
  });

  // The focus team's way through: fase liga rounds, then knockout phases.
  const own = focusTeamId === null ? [] : matches.filter((m) => m.homeId === focusTeamId || m.awayId === focusTeamId);
  const focusPath =
    own.length > 0
      ? {
          teamName: own[0].homeId === focusTeamId ? own[0].homeName : own[0].awayName,
          entries: [...own]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((match) => ({
              label: match.groupId === sectorId ? (knockoutPhase.get(match.id) ?? "Eliminatoria") : match.round ? `J${match.round}` : "Fase liga",
              match,
            })),
        }
      : null;
  const rivals =
    focusTeamId === null
      ? []
      : [
          ...new Set([
            focusTeamId,
            ...faseLigaMatches.filter((m) => m.homeId === focusTeamId || m.awayId === focusTeamId).flatMap((m) => [m.homeId, m.awayId]),
          ]),
        ];
  const previous = context.available.filter((s) => s.name < season.name).sort((a, b) => a.name.localeCompare(b.name)).at(-1);
  return {
    faseLiga,
    steps,
    knockoutStarted,
    focusPath,
    rivals,
    previousSeason: previous ? { name: previous.name, href: context.seasonHref(sectorId, previous) } : null,
  };
}

/**
 * Where a Champions fase liga's page goes: the sector's, which shows it in its "Fase liga" tab. Null for any
 * other node.
 */
export async function championsFaseLigaRedirect(segments: string[]): Promise<string | null> {
  const tree = new LeagueTree(await getLeagues());
  const node = tree.find(segments.map((s) => decodeURIComponent(s)));
  if (!node || !isFaseLiga(node.name) || !isChampionsNode(node.id, tree)) return null;
  const path = tree.path(node.id);
  return path.length === 3 ? tree.href(path[1].id) : null;
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
  const { brackets, group } = await nodeMatches(node.id, direct, { season, current, tree, now });

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

  // Sorted, so the home page and the main competition's page share one cache entry.
  const groupIds = [...new Set(matches.map((m) => m.groupId!))].sort((a, b) => a - b);
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
    champions:
      isChampionsNode(node.id, tree) && tree.path(node.id).length === 2
        ? await championsSector(node.id, matches, brackets, group, { season, current, tree, now, focusTeamId, available, seasonHref })
        : null,
    logos: Object.fromEntries(teams.map((t) => [t.id, t.logoUrl])),
    slugs: Object.fromEntries(teams.map((t) => [t.id, t.slug])),
    now,
  };
}

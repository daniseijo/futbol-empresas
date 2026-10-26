// Knockout brackets inferred from a competition node's matches. The API has no
// rounds for knockout matches, so they come from the shape of the matches
// themselves: a team's n-th match is in round n of its path, and the winners of
// one round play the next. Anything that does not fit a clean bracket is left
// out, so the page never shows a wrong one.

import { dayKey, daysBetween } from "@/lib/dates";
import type { Match } from "@/lib/sportspress/types";

export interface Tie {
  match: Match;
  /** Who went through: the better score, or the team that played the next round (draws go to penalties). */
  winnerId: number | null;
}

export interface BracketRound {
  name: string;
  /** Ordered so that ties 2k and 2k+1 feed tie k of the next round. */
  ties: Tie[];
}

export interface Bracket {
  rounds: BracketRound[];
  championId: number | null;
  teamIds: number[];
}

export interface KnockoutRound {
  name: string;
  /** "1/8", "1/4", "1/2", "F". */
  short: string;
  matches: Match[];
}

export interface Knockout {
  brackets: Bracket[];
  /** Matches that are not part of any clean bracket (placement matches, missing ties, a cup in progress...). */
  others: Match[];
  /**
   * `others` by round, when they are the early rounds of brackets of the expected size (a cup in progress,
   * before its finals are out); null if they do not fit.
   */
  rounds: KnockoutRound[] | null;
}

export interface KnockoutOptions {
  /** Winners the league recorded for this competition and season: they settle a drawn final. */
  champions?: number[];
  now: string;
  /** Teams per bracket the cup is expected to have (from its previous season), to read a cup in progress. */
  expectedSize?: number;
}

/** A just-finished final may only be a semifinal whose final is not published yet. */
const SETTLED_DAYS = 14;

const ROUND_NAMES = ["Final", "Semifinales", "Cuartos", "Octavos", "Dieciseisavos"];

/** "Final", "Semifinales"…, counted back from the last round. */
export function roundName(fromLast: number, total: number): string {
  return ROUND_NAMES[fromLast] ?? `Ronda ${total - fromLast}`;
}

/** Short label for tight spots: "F", "1/2", "1/4"… */
export function shortRoundName(fromLast: number): string {
  return fromLast === 0 ? "F" : `1/${2 ** fromLast}`;
}

const byDate = (a: Match, b: Match) => a.date.localeCompare(b.date) || a.id - b.id;

/**
 * The same tie entered twice (a test copy, a correction): same two teams on
 * the same day. The first one entered is kept.
 */
function withoutDuplicates(matches: Match[]): Match[] {
  const seen = new Set<string>();
  return [...matches]
    .sort((a, b) => a.id - b.id)
    .filter((m) => {
      const key = `${Math.min(m.homeId, m.awayId)}-${Math.max(m.homeId, m.awayId)}-${dayKey(m.date)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Groups of matches whose teams are connected by playing each other: one per bracket. */
function components(matches: Match[]): Match[][] {
  const parent = new Map<number, number>();
  const find = (team: number): number => {
    let root = team;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(team, root);
    return root;
  };
  for (const m of matches) {
    for (const team of [m.homeId, m.awayId]) if (!parent.has(team)) parent.set(team, team);
    parent.set(find(m.homeId), find(m.awayId));
  }
  const groups = new Map<number, Match[]>();
  for (const m of matches) {
    const root = find(m.homeId);
    groups.set(root, [...(groups.get(root) ?? []), m]);
  }
  return [...groups.values()].sort((a, b) => Math.min(...a.map((m) => m.id)) - Math.min(...b.map((m) => m.id)));
}

function scoreWinner(m: Match): number | null {
  if (!m.played || m.homeGoals === null || m.awayGoals === null || m.homeGoals === m.awayGoals) return null;
  return m.homeGoals > m.awayGoals ? m.homeId : m.awayId;
}

const hasTeam = (m: Match, team: number) => m.homeId === team || m.awayId === team;

/** One bracket from a connected group of matches, or null if they are not a clean single-elimination bracket. */
function toBracket(
  matches: Match[],
  champions: Set<number>,
  now: string,
  undecided: Match[],
  expectedSize: number | undefined,
): Bracket | null {
  const teams = new Set(matches.flatMap((m) => [m.homeId, m.awayId]));
  const size = teams.size;
  // At least semifinals, a power of two, and one match fewer than teams (no byes, replays or third place).
  if (size < 4 || (size & (size - 1)) !== 0 || matches.length !== size - 1) return null;
  const roundCount = Math.log2(size);

  const played = new Map<number, number>();
  const rounds: Match[][] = Array.from({ length: roundCount }, () => []);
  for (const m of [...matches].sort(byDate)) {
    const round = played.get(m.homeId) ?? 0;
    if ((played.get(m.awayId) ?? 0) !== round || round >= roundCount) return null;
    rounds[round].push(m);
    played.set(m.homeId, round + 1);
    played.set(m.awayId, round + 1);
  }
  if (rounds.some((list, r) => list.length !== size / 2 ** (r + 1))) return null;

  const winners = new Map<number, number | null>();
  for (let r = 0; r < roundCount - 1; r += 1) {
    for (const m of rounds[r]) {
      const through = [m.homeId, m.awayId].filter((team) => rounds[r + 1].some((next) => hasTeam(next, team)));
      if (through.length !== 1) return null;
      const byScore = scoreWinner(m);
      if (byScore !== null && byScore !== through[0]) return null;
      winners.set(m.id, through[0]);
    }
  }
  const final = rounds[roundCount - 1][0];
  // A later match with a team still to be decided may be this bracket's real final.
  if (undecided.some((m) => m.date > final.date)) return null;
  const finalists = [final.homeId, final.awayId].filter((team) => champions.has(team));
  const champion = scoreWinner(final) ?? (final.played && finalists.length === 1 ? finalists[0] : null);
  winners.set(final.id, champion);
  // Without a recorded champion, a recent "final" could be a semifinal whose final is not out yet, unless
  // the bracket already has the size the cup's brackets have.
  const settled = (champion !== null && champions.has(champion)) || size === expectedSize || daysBetween(final.date, now) > SETTLED_DAYS;
  if (!settled) return null;

  // From the final back: each tie is followed by the ties that fed it, home side first.
  const ordered: Match[][] = Array.from({ length: roundCount }, () => []);
  ordered[roundCount - 1] = [final];
  for (let r = roundCount - 2; r >= 0; r -= 1) {
    for (const next of ordered[r + 1]) {
      for (const team of [next.homeId, next.awayId]) ordered[r].push(rounds[r].find((m) => hasTeam(m, team))!);
    }
  }

  return {
    rounds: ordered.map((list, r) => ({
      name: roundName(roundCount - 1 - r, roundCount),
      ties: list.map((match) => ({
        match,
        winnerId: winners.get(match.id) ?? null,
      })),
    })),
    championId: champion,
    teamIds: [...teams],
  };
}

/**
 * Matches of a cup in progress by round, with brackets of `size` teams: a team's n-th match is in round n,
 * and whoever plays a round won (or drew) their tie of the one before. Null if they do not fit, so the page
 * lists them by date instead of naming a round wrongly.
 */
function inProgressRounds(matches: Match[], size: number): KnockoutRound[] | null {
  if (matches.length === 0 || size < 4 || (size & (size - 1)) !== 0) return null;
  const roundCount = Math.log2(size);
  const played = new Map<number, Match[]>();
  const rounds: Match[][] = Array.from({ length: roundCount }, () => []);
  for (const m of [...matches].sort(byDate)) {
    const known = [m.homeId, m.awayId].filter((team) => team > 0);
    const counts = known.map((team) => played.get(team) ?? []);
    const round = counts[0]?.length ?? -1;
    if (known.length === 0 || counts.some((list) => list.length !== round) || round >= roundCount) return null;
    for (const [i, team] of known.entries()) {
      const previous = counts[i].at(-1);
      // Whoever plays on lost nothing before: a decisive score against them means this is not a knockout.
      if (previous && scoreWinner(previous) !== null && scoreWinner(previous) !== team) return null;
      played.set(team, [...counts[i], m]);
    }
    rounds[round].push(m);
  }
  // Every bracket starts with size / 2 ties.
  if (rounds[0].length === 0 || rounds[0].length % (size / 2) !== 0) return null;
  return rounds
    .map((list, r) => ({ name: roundName(roundCount - 1 - r, roundCount), short: shortRoundName(roundCount - 1 - r), matches: list }))
    .filter((round) => round.matches.length > 0);
}

/**
 * The brackets in a node's matches. `now` keeps a cup in progress out until its final is settled: played
 * more than two weeks ago, its champion recorded, or the bracket already as big as `expectedSize`.
 */
export function buildKnockout(matches: Match[], { champions = [], now, expectedSize }: KnockoutOptions): Knockout {
  const winners = new Set(champions);
  const undecided = matches.filter((m) => m.homeId <= 0 || m.awayId <= 0);
  const brackets: Bracket[] = [];
  // Matches with a team still to be decided (id -1) would join unrelated brackets.
  const others: Match[] = [...undecided];
  const decided = withoutDuplicates(matches.filter((m) => !undecided.includes(m)));
  for (const group of components(decided)) {
    const bracket = toBracket(group, winners, now, undecided, expectedSize);
    if (bracket) brackets.push(bracket);
    else others.push(...group);
  }
  others.sort(byDate);
  const rounds = expectedSize ? inProgressRounds(others, expectedSize) : null;
  return { brackets, others, rounds };
}

/** The most common number of teams per bracket, if there are brackets. */
export function bracketSize(brackets: Bracket[]): number | undefined {
  const counts = new Map<number, number>();
  for (const bracket of brackets) counts.set(bracket.teamIds.length, (counts.get(bracket.teamIds.length) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Each knockout match with its round's short name ("1/4"), for lists of matches. */
export function knockoutLabels(knockout: Knockout): Map<number, string> {
  const labels = new Map<number, string>();
  for (const bracket of knockout.brackets) {
    bracket.rounds.forEach((round, r) => {
      for (const tie of round.ties) labels.set(tie.match.id, shortRoundName(bracket.rounds.length - 1 - r));
    });
  }
  for (const round of knockout.rounds ?? []) for (const m of round.matches) labels.set(m.id, round.short);
  return labels;
}

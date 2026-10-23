import { cacheLife } from "next/cache";
import { getCurrentSeason, getPlayerCareer, getSeasons, getTeams } from "@/lib/data";
import type { Match, Outcome, Position } from "@/lib/sportspress/types";
import { nowInMadrid } from "@/lib/dates";
import { outcomeFor } from "@/lib/standings";

export interface PlayerTotals {
  matches: number;
  goals: number;
  assists: number;
  cracks: number;
  yellowCards: number;
  redCards: number;
}

/** One season at one team. */
export interface PlayerSeasonRow extends PlayerTotals {
  season: string;
  teamId: number;
  teamName: string;
}

/** A match from the player's point of view: their team, the result and what they did. */
export interface PlayerMatchRow {
  match: Match;
  teamId: number;
  outcome: Outcome | null;
  goals: number;
  minutes: number[];
  assists: number;
  crack: boolean;
  yellowCards: number;
  redCards: number;
}

export interface PlayerPageData {
  id: number;
  /** Profile name; empty if the profile is private. */
  name: string;
  displayName: string;
  photoUrl: string | null;
  number: string | null;
  position: Position | null;
  team: { id: number; name: string } | null;
  totals: PlayerTotals;
  /** Values the league computes for the current season squad. */
  current: { mvpPoints: number; marketValue: number } | null;
  seasons: PlayerSeasonRow[];
  matches: PlayerMatchRow[];
  now: string;
  logos: Record<number, string | null>;
  slugs: Record<number, string>;
}

function emptyTotals(): PlayerTotals {
  return { matches: 0, goals: 0, assists: 0, cracks: 0, yellowCards: 0, redCards: 0 };
}

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export async function getPlayerPageData(id: number): Promise<PlayerPageData | null> {
  "use cache";
  cacheLife("results");

  const [career, seasons, current, teams] = await Promise.all([getPlayerCareer(id), getSeasons(), getCurrentSeason(), getTeams()]);
  if (!career) return null;
  const { player, lines, squads } = career;
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const seasonName = new Map(seasons.map((s) => [s.id, s.name]));

  const totals = emptyTotals();
  const bySeason = new Map<string, PlayerSeasonRow>();
  for (const { match, line } of lines) {
    const key = `${match.seasonId}:${line.teamId}`;
    let row = bySeason.get(key);
    if (!row) {
      row = { ...emptyTotals(), season: seasonName.get(match.seasonId ?? 0) ?? "", teamId: line.teamId, teamName: teamName.get(line.teamId) ?? "" };
      bySeason.set(key, row);
    }
    for (const target of [totals, row]) {
      target.matches += 1;
      target.goals += line.goals;
      target.assists += line.assists;
      target.cracks += line.crack ? 1 : 0;
      target.yellowCards += line.yellowCards;
      target.redCards += line.redCards;
    }
  }

  // Team and shirt number from the latest match; if none yet, from the squad.
  const last = lines.at(-1);
  const teamId = last?.line.teamId ?? squads[0]?.teamId ?? null;
  const number = last?.line.number ?? squads[0]?.number ?? null;
  const inCurrentSeason = !last || last.match.seasonId === current.id;
  const squad = inCurrentSeason ? squads.find((s) => s.teamId === teamId) : undefined;

  return {
    id,
    now: nowInMadrid(),
    name: player.name,
    displayName: player.name || (number ? `Dorsal ${number}` : "Jugador"),
    photoUrl: player.photoUrl,
    number,
    position: mostCommon(lines.map((l) => l.line.position).filter((p) => p !== null)) ?? ((squads[0]?.position as Position | null) ?? null),
    team: teamId ? { id: teamId, name: teamName.get(teamId) ?? "" } : null,
    totals,
    current: squad ? { mvpPoints: squad.mvpPoints, marketValue: squad.marketValue } : null,
    seasons: [...bySeason.values()].reverse(),
    matches: lines
      .map(({ match, line }) => ({
        match,
        teamId: line.teamId,
        outcome: outcomeFor(match, line.teamId),
        goals: line.goals,
        minutes: line.minutes,
        assists: line.assists,
        crack: line.crack,
        yellowCards: line.yellowCards,
        redCards: line.redCards,
      }))
      .reverse(),
    logos: Object.fromEntries(teams.map((t) => [t.id, t.logoUrl])),
    slugs: Object.fromEntries(teams.map((t) => [t.id, t.slug])),
  };
}

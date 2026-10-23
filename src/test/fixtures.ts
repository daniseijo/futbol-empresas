// Small builders for test data: only the fields a test cares about, sensible defaults for the rest.

import type { Match, StandingRow } from "@/lib/sportspress/types";

let nextId = 1;

/** A match between two teams; give it goals to make it played. */
export function match(fields: Partial<Match> & { homeId: number; awayId: number }): Match {
  const played = fields.played ?? (fields.homeGoals != null && fields.awayGoals != null);
  return {
    id: nextId++,
    date: "2026-10-22T21:00",
    round: null,
    homeName: `Equipo ${fields.homeId}`,
    awayName: `Equipo ${fields.awayId}`,
    homeGoals: null,
    awayGoals: null,
    seasonId: 1,
    leagueIds: [],
    groupId: null,
    competitionId: null,
    venueId: null,
    scorers: [],
    ...fields,
    played,
  };
}

/** A played match with its score. */
export function result(homeId: number, homeGoals: number, awayGoals: number, awayId: number, fields: Partial<Match> = {}): Match {
  return match({ homeId, awayId, homeGoals, awayGoals, ...fields });
}

export function standingRow(fields: Partial<StandingRow> & { position: number; points: number }): StandingRow {
  return {
    teamId: fields.position,
    name: `Equipo ${fields.position}`,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    form: [],
    ...fields,
  };
}

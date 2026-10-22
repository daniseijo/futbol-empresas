import type { Match, Outcome, StandingRow } from "./sportspress/types";

const FORM_LENGTH = 5;

export function outcomeFor(match: Match, teamId: number): Outcome | null {
  if (!match.played || match.homeGoals === null || match.awayGoals === null) return null;
  const isHome = match.homeId === teamId;
  const own = isHome ? match.homeGoals : match.awayGoals;
  const other = isHome ? match.awayGoals : match.homeGoals;
  if (own > other) return "V";
  if (own === other) return "E";
  return "D";
}

/**
 * Clasificación calculada a partir de los partidos (3 puntos por victoria, 1
 * por empate). Sirve para cualquier temporada: la API guarda una sola tabla
 * por grupo y la reutiliza cada año, así que las pasadas hay que recalcularlas.
 * Desempate: puntos, diferencia de goles, goles a favor y nombre.
 */
export function computeStandings(matches: Match[]): StandingRow[] {
  const rows = new Map<number, StandingRow>();
  const ensure = (teamId: number, name: string) => {
    let row = rows.get(teamId);
    if (!row) {
      row = { position: 0, teamId, name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] };
      rows.set(teamId, row);
    }
    return row;
  };

  const ordered = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  for (const match of ordered) {
    ensure(match.homeId, match.homeName);
    ensure(match.awayId, match.awayName);
    for (const teamId of [match.homeId, match.awayId]) {
      const outcome = outcomeFor(match, teamId);
      if (!outcome) continue;
      const row = rows.get(teamId)!;
      const isHome = match.homeId === teamId;
      row.played += 1;
      row.goalsFor += (isHome ? match.homeGoals : match.awayGoals) ?? 0;
      row.goalsAgainst += (isHome ? match.awayGoals : match.homeGoals) ?? 0;
      if (outcome === "V") {
        row.won += 1;
        row.points += 3;
      } else if (outcome === "E") {
        row.drawn += 1;
        row.points += 1;
      } else {
        row.lost += 1;
      }
      row.form = [...row.form, outcome].slice(-FORM_LENGTH);
    }
  }

  return [...rows.values()]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor ||
        a.name.localeCompare(b.name, "es"),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export function goalDifference(row: StandingRow): number {
  return row.goalsFor - row.goalsAgainst;
}

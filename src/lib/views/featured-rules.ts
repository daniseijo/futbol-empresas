// The pure rules behind a team's featured match, kept apart from featured.ts
// (which reads the database) so they can be tested on their own.

import { daysBetween, weekStart } from "@/lib/dates";
import type { Match, StandingRow } from "@/lib/sportspress/types";
import { computeStandings } from "@/lib/standings";
import type { TeamContext } from "./team-context";

/** Whether the summary leads with the last result or the next match's preview, and which match. */
export function featuredMode(
  context: Pick<TeamContext, "lastResults" | "nextMatch">,
  now: string,
): { mode: "result" | "preview"; matchId: number | null; daysToNext: number | null } {
  const last = context.lastResults[0] ?? null;
  const daysToNext = context.nextMatch ? daysBetween(now, context.nextMatch.date) : null;
  // The preview replaces the last result from the Monday of the week the next match is played.
  const previewDue = context.nextMatch && (daysToNext! <= 0 || weekStart(now) === weekStart(context.nextMatch.date));
  const mode = context.nextMatch && (!last || previewDue) ? "preview" : "result";
  const match = mode === "preview" ? context.nextMatch : last;
  return { mode, matchId: match?.id ?? null, daysToNext };
}

/** The team's position in its group before a round, to tell whether that round moved it. */
export function positionBefore(seasonMatches: Match[], groupId: number, teamId: number, round: number): number | null {
  const before = computeStandings(seasonMatches.filter((m) => m.leagueIds.includes(groupId) && m.round !== round));
  return before.find((r) => r.teamId === teamId)?.position ?? null;
}

/** "Sube a 7º", "Baja a 9º" or "Sigue 9º" after the last round. */
export function trend(position: number, previous: number | null): string {
  if (previous === null || previous === position) return previous === null ? `${position}º` : `Sigue ${position}º`;
  return `${position < previous ? "Sube" : "Baja"} a ${position}º`;
}

/** The distance to the team right above (or, for the leader, to the second). */
export function gap(rows: StandingRow[], row: StandingRow): string | null {
  const points = (n: number) => `${n} ${n === 1 ? "punto" : "puntos"}`;
  if (row.position === 1) {
    const second = rows[1];
    if (!second) return null;
    const lead = row.points - second.points;
    return lead > 0 ? `${points(lead)} por delante de ${second.name}` : `Empatado a puntos con ${second.name}`;
  }
  const above = rows[rows.indexOf(row) - 1];
  if (!above) return null;
  const diff = above.points - row.points;
  return diff === 0 ? `Empatado a puntos con ${above.name}` : `A ${points(diff)} de ${above.name}`;
}

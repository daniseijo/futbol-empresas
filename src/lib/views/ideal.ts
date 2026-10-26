import { getPlayers } from "@/lib/data";
import { IDEAL_SHAPE, idealSeven, type SheetTotals } from "@/lib/ideal-seven";
import { playerDisplayName } from "@/lib/players";
import type { Position, TeamSummary } from "@/lib/sportspress/types";

export interface IdealSlot {
  playerId: number;
  name: string;
  photoUrl: string | null;
  teamName: string;
  logoUrl: string | null;
  score: number;
}

/** The ideal 7 line by line, forwards first; null when nobody has played yet. */
export type IdealSevenData = { position: Position; players: IdealSlot[] }[] | null;

export async function buildIdealSeven(totals: SheetTotals[], teams: TeamSummary[]): Promise<IdealSevenData> {
  const seven = idealSeven(totals);
  const ids = Object.values(seven).flatMap((line) => line.map((p) => p.playerId));
  if (ids.length === 0) return null;
  const players = await getPlayers(ids);
  const byId = new Map(teams.map((t) => [t.id, t]));
  return IDEAL_SHAPE.map(([position]) => ({
    position,
    players: seven[position].map((p) => ({
      playerId: p.playerId,
      name: playerDisplayName(players[p.playerId]?.name),
      photoUrl: players[p.playerId]?.photoUrl ?? null,
      teamName: byId.get(p.teamId)?.name ?? "",
      logoUrl: byId.get(p.teamId)?.logoUrl ?? null,
      score: p.score,
    })),
  }));
}

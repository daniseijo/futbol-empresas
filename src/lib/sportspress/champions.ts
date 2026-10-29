// "La Champions de las Empresas": which matches belong to it and where in it they are.

import { slugify, type LeagueTree } from "./leagues";
import type { Match } from "./types";

/**
 * The Champions' root, by its name. Its id is the API's to change, and its WordPress slug
 * ("3-la-champions-de-las-empresas") is not the one the site's URLs use.
 */
const CHAMPIONS_NAME = "la-champions-de-las-empresas";

/** The road to the final, in order (the 25/26 format: fase liga, then a play-off for 5th–12th, then the knockout). */
export const CHAMPIONS_PHASES = ["Fase liga", "Eliminatoria", "Cuartos", "Semis", "Final"] as const;
export type ChampionsPhase = (typeof CHAMPIONS_PHASES)[number];

/** Where a Champions match sits: its phase, its fase liga round and its sector. */
export interface ChampionsStage {
  phase: ChampionsPhase;
  round: number | null;
  /** "Banca y Financiero", without the "Sector " prefix. */
  sector: string | null;
}

export function isChampions(match: Pick<Match, "competitionId">, tree: LeagueTree): boolean {
  return match.competitionId !== null && isChampionsNode(match.competitionId, tree);
}

/** Whether a node of the league tree is the Champions or under it. */
export function isChampionsNode(id: number, tree: LeagueTree): boolean {
  const root = tree.competitionOf(id);
  return root !== undefined && slugify(root.name) === CHAMPIONS_NAME;
}

/** The "Champions Fase Liga - <sector>" node under each sector. */
export const isFaseLiga = (name: string) => /fase liga/i.test(name);

/** The knockout phase for a bracket round's short name ("1/4", "1/2", "F"). Earlier rounds are the play-off. */
const KNOCKOUT_PHASES: Record<string, ChampionsPhase> = { F: "Final", "1/2": "Semis", "1/4": "Cuartos" };

/**
 * A match's place in the Champions, or null if it is not a Champions match. Fase liga matches live in a
 * "Champions Fase Liga - <sector>" node and have a round (the API forgets it on some); knockout matches hang
 * from the sector itself, and `roundLabel` (from the bracket) tells their phase.
 */
export function championsStage(
  match: Pick<Match, "competitionId" | "groupId" | "round">,
  tree: LeagueTree,
  roundLabel?: string,
): ChampionsStage | null {
  if (!isChampions(match, tree)) return null;
  const path = match.groupId ? tree.path(match.groupId) : [];
  const sector = path[1] ? path[1].name.replace(/^Sector\s+/i, "") : null;
  const inFaseLiga = match.round !== null || isFaseLiga(path.at(-1)?.name ?? "");
  const phase = inFaseLiga ? "Fase liga" : (KNOCKOUT_PHASES[roundLabel ?? ""] ?? "Eliminatoria");
  return { phase, round: inFaseLiga ? match.round : null, sector };
}

/** "Fase liga · Jornada 1", "Fase liga · J1" (short) or "Cuartos". */
export function championsStageLabel(stage: ChampionsStage, short = false): string {
  if (stage.round === null) return stage.phase;
  return `${stage.phase} · ${short ? "J" : "Jornada "}${stage.round}`;
}

import type { League } from "./types";

// Las "leagues" de SportsPress forman un árbol: competición › fase › grupo
// (Liga Apertura › Fase 1 › Grupo 20). Un partido lleva varios ids de ese árbol.

export class LeagueTree {
  private readonly byId: Map<number, League>;
  private readonly childIds: Map<number, number[]>;

  constructor(leagues: League[]) {
    this.byId = new Map(leagues.map((league) => [league.id, league]));
    this.childIds = new Map();
    for (const league of leagues) {
      if (league.parentId === null) continue;
      const siblings = this.childIds.get(league.parentId) ?? [];
      siblings.push(league.id);
      this.childIds.set(league.parentId, siblings);
    }
  }

  get(id: number): League | undefined {
    return this.byId.get(id);
  }

  name(id: number): string {
    return this.byId.get(id)?.name ?? "";
  }

  children(id: number): League[] {
    return (this.childIds.get(id) ?? []).map((childId) => this.byId.get(childId)!).filter(Boolean);
  }

  /** Raíz del árbol: la competición (Liga Apertura, Champions...). */
  competitionOf(id: number): League | undefined {
    let current = this.byId.get(id);
    while (current?.parentId !== null && current?.parentId !== undefined) {
      const parent = this.byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }

  /** Ancestros de un nodo, de la raíz al propio nodo. */
  path(id: number): League[] {
    const chain: League[] = [];
    let current = this.byId.get(id);
    while (current) {
      chain.unshift(current);
      current = current.parentId === null ? undefined : this.byId.get(current.parentId);
    }
    return chain;
  }

  /** El nodo más profundo de los que lleva un partido (normalmente el grupo). */
  deepest(ids: number[]): League | undefined {
    const known = ids.filter((id) => this.byId.has(id));
    let best: League | undefined;
    let bestDepth = -1;
    for (const id of known) {
      const depth = this.path(id).length;
      if (depth > bestDepth) {
        best = this.byId.get(id);
        bestDepth = depth;
      }
    }
    return best;
  }
}

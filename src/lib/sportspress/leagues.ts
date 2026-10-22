import type { League } from "./types";

// Las "leagues" de SportsPress forman un árbol: competición › fase › grupo
// (Liga Apertura › Fase 1 › Grupo 20). Un partido lleva varios ids de ese árbol.

/** "Corporate Cup – Tercera Div" → "corporate-cup-tercera-div". */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export class LeagueTree {
  private readonly byId: Map<number, League>;
  private readonly childIds: Map<number, number[]>;
  /**
   * Segmento de URL de cada nodo, sacado del nombre. Los slugs de WordPress no
   * sirven («grupo-1-fase-i», «18-torneo-clausura»); los nombres solo se repiten
   * entre ramas distintas, y si dos hermanos coinciden el segundo lleva su id.
   */
  private readonly segments = new Map<number, string>();

  constructor(leagues: League[]) {
    this.byId = new Map(leagues.map((league) => [league.id, league]));
    this.childIds = new Map();
    for (const league of leagues) {
      if (league.parentId === null) continue;
      const siblings = this.childIds.get(league.parentId) ?? [];
      siblings.push(league.id);
      this.childIds.set(league.parentId, siblings);
    }
    const taken = new Set<string>();
    for (const league of [...leagues].sort((a, b) => a.id - b.id)) {
      let segment = slugify(league.name);
      if (taken.has(`${league.parentId}/${segment}`)) segment = `${segment}-${league.id}`;
      taken.add(`${league.parentId}/${segment}`);
      this.segments.set(league.id, segment);
    }
  }

  /** Ruta de un nodo en la web: /competiciones/liga-apertura/fase-1/grupo-1. */
  href(id: number, season?: string): string {
    const path = this.path(id).map((league) => this.segments.get(league.id));
    return `/competiciones/${path.join("/")}${season ? `?temporada=${season.replace("/", "-")}` : ""}`;
  }

  /** El nodo de una ruta de la web, o undefined si no existe. */
  find(segments: string[]): League | undefined {
    let candidates = [...this.byId.values()].filter((league) => league.parentId === null);
    let found: League | undefined;
    for (const segment of segments) {
      found = candidates.find((league) => this.segments.get(league.id) === segment);
      if (!found) return undefined;
      candidates = this.children(found.id);
    }
    return found;
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

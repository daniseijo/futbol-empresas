// Modelo de dominio limpio sobre el que trabaja la web. Todo lo que sale de
// data.ts está ya normalizado: números como números y textos sin entidades HTML.

export type Position = "POR" | "DEF" | "MED" | "DEL";
export type Outcome = "V" | "E" | "D";

export interface Season {
  id: number;
  name: string; // "26/27"
}

export interface League {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
}

export interface TeamSummary {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  seasonIds: number[];
}

export interface Team extends TeamSummary {
  /** Foto de equipo real. null si no hay o si es la plantilla de siluetas. */
  photoUrl: string | null;
  video: { url: string; title: string; thumbnailUrl: string | null } | null;
  flickrAlbumUrl: string | null;
  /** Competiciones y grupos en los que está inscrito (el más profundo es el grupo actual). */
  leagueIds: number[];
}

export interface Scorer {
  playerId: number;
  teamId: number;
  number: string | null;
  goals: number;
  minutes: number[];
  assists: number;
  crack: boolean;
  dandy: boolean;
}

export interface Match {
  id: number;
  /** Hora local de Madrid, "YYYY-MM-DDTHH:mm". */
  date: string;
  round: number | null;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  /** Un partido con resultado cuenta como jugado aunque la API diga "future". */
  played: boolean;
  seasonId: number | null;
  leagueIds: number[];
  /** El nodo más profundo del árbol de competiciones (el grupo) y su raíz. */
  groupId: number | null;
  competitionId: number | null;
  venueId: number | null;
  scorers: Scorer[];
}

export interface MatchDetail extends Match {
  photos: string[];
  /** Resumen en YouTube del partido, si la liga lo ha publicado. */
  video: { id: string; title: string | null } | null;
}

/** Un jugador en el acta de un partido. */
export interface LineupPlayer {
  playerId: number;
  teamId: number;
  name: string;
  photoUrl: string | null;
  number: string | null;
  position: Position | null;
  goals: number;
  minutes: number[];
  assists: number;
  yellowCards: number;
  redCards: number;
  crack: boolean;
  dandy: boolean;
  points: number;
}

export interface StandingRow {
  position: number;
  teamId: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Últimos resultados, del más antiguo al más reciente. */
  form: Outcome[];
}

export interface SquadPlayer {
  id: number;
  name: string;
  number: string | null;
  position: Position | null;
  photoUrl: string | null;
  appearances: number;
  goals: number;
  assists: number;
  mvpPoints: number;
  marketValue: number;
  crack: number;
  dandy: number;
}

export interface Venue {
  id: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

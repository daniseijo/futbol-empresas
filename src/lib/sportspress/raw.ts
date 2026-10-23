// Raw API shapes (only the fields we use). Everything from WordPress arrives
// as text: numbers, scores and stats.

export interface RawRendered {
  rendered: string;
}

export interface RawTerm {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
}

export interface RawTeam {
  id: number;
  slug: string;
  title: RawRendered;
  featured_media: number;
  leagues: number[];
  seasons: number[];
  lists?: number[];
  content?: RawRendered;
}

export interface RawPerformanceRow {
  number?: string;
  position?: string[];
  goals?: string | number;
  asistencia?: string | number;
  yellowcards?: string | number;
  redcards?: string | number;
  crack?: string | number;
  dandy?: string | number;
  puntuacion?: string | number;
  status?: string | number;
}

export interface RawEvent {
  id: number;
  date: string;
  status: string;
  title: RawRendered;
  leagues: number[];
  seasons: number[];
  venues: number[];
  teams: number[];
  main_results: string[];
  results?: Record<string, Record<string, unknown>>;
  /** { [teamId]: { [playerId | "0"]: row } }; for future matches it may be an array. */
  performance?: Record<string, Record<string, RawPerformanceRow> | RawPerformanceRow[]>;
  content?: RawRendered;
}

export interface RawTable {
  id: number;
  title: RawRendered;
  leagues: number[];
  data: Record<string, Record<string, string | number>>;
}

export interface RawList {
  id: number;
  title: RawRendered;
  data: Record<string, Record<string, string | number>>;
}

export interface RawPlayer {
  id: number;
  slug: string;
  title: RawRendered;
  number: number | string | null;
  positions: number[];
  featured_media: number;
  current_teams?: number[];
}

export interface RawMedia {
  id: number;
  source_url: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url: string; width: number; height: number }>;
  };
}

export interface RawTournament {
  id: number;
  title: RawRendered;
  leagues: number[];
  seasons: number[];
  winner: number | string | null;
}

export interface RawPost {
  id: number;
  date: string;
  link: string;
  title: RawRendered;
}

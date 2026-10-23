// Clean domain model the site works with. Everything coming out of data.ts is
// already normalized: numbers as numbers and text without HTML entities.

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
  /** Real team photo. null if there is none or it is the silhouette template. */
  photoUrl: string | null;
  video: { url: string; title: string; thumbnailUrl: string | null } | null;
  flickrAlbumUrl: string | null;
  /** Competitions and groups the team is registered in (the deepest is the current group). */
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
  /** Madrid local time, "YYYY-MM-DDTHH:mm". */
  date: string;
  round: number | null;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  /** A match with a score counts as played even if the API says "future". */
  played: boolean;
  seasonId: number | null;
  leagueIds: number[];
  /** The deepest node of the competition tree (the group) and its root. */
  groupId: number | null;
  competitionId: number | null;
  venueId: number | null;
  scorers: Scorer[];
}

export interface MatchDetail extends Match {
  photos: string[];
  /** The match's YouTube highlights, if the league has published them. */
  video: { id: string; title: string | null } | null;
}

/** A player on a match sheet. */
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
  /** Latest results, oldest first. */
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

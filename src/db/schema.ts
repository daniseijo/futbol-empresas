import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Copia local de la API de futbolempresas.es. La rellena `pnpm sync` (src/sync)
// y las páginas solo leen de aquí: nunca llaman a la API al renderizar.

export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(), // "26/27"
});

/** Árbol competición › fase › grupo. */
export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  parentId: integer("parent_id"),
});

export const teams = sqliteTable(
  "teams",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    /** Foto de equipo real; null si no hay o si es la plantilla de siluetas. */
    photoUrl: text("photo_url"),
    youtubeUrl: text("youtube_url"),
    youtubeTitle: text("youtube_title"),
    youtubeThumbnailUrl: text("youtube_thumbnail_url"),
    flickrAlbumUrl: text("flickr_album_url"),
    seasonIds: text("season_ids", { mode: "json" }).$type<number[]>().notNull(),
    leagueIds: text("league_ids", { mode: "json" }).$type<number[]>().notNull(),
    listIds: text("list_ids", { mode: "json" }).$type<number[]>().notNull(),
    /** Fecha de modificación en WordPress, para la sincronización incremental. */
    modified: text("modified"),
    /** Cuándo se descargaron por última vez la foto, el vídeo y el álbum. */
    detailSyncedAt: text("detail_synced_at"),
    /** Cuándo se descargó por última vez su plantilla. */
    squadSyncedAt: text("squad_synced_at"),
  },
  (t) => [index("teams_slug").on(t.slug)],
);

export const matches = sqliteTable(
  "matches",
  {
    id: integer("id").primaryKey(),
    /** Hora local de Madrid, "YYYY-MM-DDTHH:mm". */
    date: text("date").notNull(),
    round: integer("round"),
    seasonId: integer("season_id"),
    homeId: integer("home_id").notNull(),
    awayId: integer("away_id").notNull(),
    homeName: text("home_name").notNull(),
    awayName: text("away_name").notNull(),
    homeGoals: integer("home_goals"),
    awayGoals: integer("away_goals"),
    played: integer("played", { mode: "boolean" }).notNull(),
    leagueIds: text("league_ids", { mode: "json" }).$type<number[]>().notNull(),
    /** El nodo más profundo del árbol (normalmente el grupo) y su raíz. */
    groupId: integer("group_id"),
    competitionId: integer("competition_id"),
    venueId: integer("venue_id"),
    photos: text("photos", { mode: "json" }).$type<string[]>().notNull(),
    /** Resumen en YouTube: el campo «Vídeo» del partido, que solo sale en su página web. */
    videoId: text("video_id"),
    videoTitle: text("video_title"),
    /** Última vez que se miró la página del partido buscando el vídeo. */
    videoCheckedAt: text("video_checked_at"),
    modified: text("modified"),
  },
  (t) => [
    index("matches_season").on(t.seasonId, t.date),
    index("matches_group").on(t.groupId, t.seasonId),
    index("matches_home").on(t.homeId),
    index("matches_away").on(t.awayId),
  ],
);

/** Alineaciones: una fila por jugador, equipo y partido, con su acta. */
export const matchPlayers = sqliteTable(
  "match_players",
  {
    matchId: integer("match_id").notNull(),
    playerId: integer("player_id").notNull(),
    teamId: integer("team_id").notNull(),
    number: text("number"),
    position: text("position"),
    goals: integer("goals").notNull(),
    minutes: text("minutes", { mode: "json" }).$type<number[]>().notNull(),
    assists: integer("assists").notNull(),
    yellowCards: integer("yellow_cards").notNull(),
    redCards: integer("red_cards").notNull(),
    crack: integer("crack", { mode: "boolean" }).notNull(),
    dandy: integer("dandy", { mode: "boolean" }).notNull(),
    points: real("points").notNull(),
  },
  // Incluye el equipo: a veces un mismo jugador figura en las dos alineaciones
  // (p. ej. una portera que juega con ambos equipos en la liga femenina).
  (t) => [primaryKey({ columns: [t.matchId, t.teamId, t.playerId] }), index("match_players_player").on(t.playerId)],
);

export const players = sqliteTable("players", {
  id: integer("id").primaryKey(),
  slug: text("slug"),
  name: text("name").notNull(),
  photoUrl: text("photo_url"),
});

/** Plantilla de la temporada en curso, con los valores que calcula la liga (MVP, valor). */
export const squadPlayers = sqliteTable(
  "squad_players",
  {
    teamId: integer("team_id").notNull(),
    playerId: integer("player_id").notNull(),
    number: text("number"),
    position: text("position"),
    appearances: integer("appearances").notNull(),
    goals: integer("goals").notNull(),
    assists: integer("assists").notNull(),
    mvpPoints: real("mvp_points").notNull(),
    marketValue: real("market_value").notNull(),
    crack: integer("crack").notNull(),
    dandy: integer("dandy").notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.playerId] })],
);

export const tournaments = sqliteTable("tournaments", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  seasonId: integer("season_id"),
  competitionId: integer("competition_id"),
  winnerId: integer("winner_id"),
});

export const news = sqliteTable("news", {
  id: integer("id").primaryKey(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
});

/** Marcas de la sincronización (última ejecución de cada tarea). */
export const syncState = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

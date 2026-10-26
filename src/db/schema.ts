import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Local copy of the futbolempresas.es API. `pnpm sync` (src/sync) fills it and
// pages only read from here: they never call the API while rendering.

export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(), // "26/27"
});

/** Competition › phase › group tree. */
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
    /** Real team photo; null if there is none or it is the silhouette template. */
    photoUrl: text("photo_url"),
    youtubeUrl: text("youtube_url"),
    youtubeTitle: text("youtube_title"),
    youtubeThumbnailUrl: text("youtube_thumbnail_url"),
    flickrAlbumUrl: text("flickr_album_url"),
    seasonIds: text("season_ids", { mode: "json" }).$type<number[]>().notNull(),
    leagueIds: text("league_ids", { mode: "json" }).$type<number[]>().notNull(),
    listIds: text("list_ids", { mode: "json" }).$type<number[]>().notNull(),
    /** WordPress modification date, for the incremental sync. */
    modified: text("modified"),
    /** When the photo, video and album were last downloaded. */
    detailSyncedAt: text("detail_synced_at"),
    /** When its squad was last downloaded. */
    squadSyncedAt: text("squad_synced_at"),
  },
  (t) => [index("teams_slug").on(t.slug)],
);

export const matches = sqliteTable(
  "matches",
  {
    id: integer("id").primaryKey(),
    /** Madrid local time, "YYYY-MM-DDTHH:mm". */
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
    /** The deepest tree node (usually the group) and its root. */
    groupId: integer("group_id"),
    competitionId: integer("competition_id"),
    venueId: integer("venue_id"),
    photos: text("photos", { mode: "json" }).$type<string[]>().notNull(),
    /** YouTube highlights: the match's "Vídeo" field, only shown on its web page. */
    videoId: text("video_id"),
    videoTitle: text("video_title"),
    /** Last time the match page was checked for the video. */
    videoCheckedAt: text("video_checked_at"),
    modified: text("modified"),
  },
  (t) => [
    index("matches_season").on(t.seasonId, t.date),
    index("matches_group").on(t.groupId, t.seasonId),
    index("matches_home").on(t.homeId),
    index("matches_away").on(t.awayId),
    // Matches whose video was never checked: the archive backfill finds them
    // without scanning the whole table (~10,000 rows on every run).
    index("matches_video_unchecked")
      .on(t.date)
      .where(sql`${t.videoCheckedAt} is null`),
  ],
);

/** Lineups: one row per player, team and match, with their match sheet. */
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
  // Includes the team: sometimes the same player is in both lineups
  // (e.g. a goalkeeper who plays for both teams in the women's league).
  (t) => [
    primaryKey({ columns: [t.matchId, t.teamId, t.playerId] }),
    index("match_players_player").on(t.playerId),
    // The players with something to show (goals, assists, awards), about a third
    // of each lineup: the pages read only these (`scorersFor` in data.ts), and
    // through the primary key they read every lineup row of the season instead.
    index("match_players_scorers")
      .on(t.matchId)
      .where(sql`${t.goals} > 0 or ${t.assists} > 0 or ${t.crack} = 1 or ${t.dandy} = 1`),
  ],
);

export const players = sqliteTable("players", {
  id: integer("id").primaryKey(),
  slug: text("slug"),
  name: text("name").notNull(),
  photoUrl: text("photo_url"),
  /**
   * Team of their latest match (or, if they have not played, of their squad),
   * kept by the sync so the search index does not have to scan every lineup.
   */
  lastTeamId: integer("last_team_id"),
  /** Date of that match, so the sync can update it without reading lineups. */
  lastMatchDate: text("last_match_date"),
});

/** Current season squad, with the values the league computes (MVP, market value). */
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
  // By player: a player's page reads their squads (the whole table without it).
  (t) => [primaryKey({ columns: [t.teamId, t.playerId] }), index("squad_players_player").on(t.playerId)],
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

/** Sync bookmarks (progress cursors and the last run of each task). */
export const syncState = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Call-ups already sent (`pnpm notify`), one row per match and channel. The
 * fingerprint is the date and venue it announced: when they change, the match
 * is announced again as rescheduled.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    matchId: integer("match_id").notNull(),
    /** Where it was sent: "telegram" and "slack" (the env-configured channels) or "sub:<subscription id>". */
    channel: text("channel").notNull(),
    fingerprint: text("fingerprint").notNull(),
    /** Madrid local time. */
    sentAt: text("sent_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.channel] })],
);

/**
 * Slack channels subscribed to a team's call-ups from its page ("Recibir
 * convocatorias en Slack"). Written by the OAuth callback, read by `pnpm notify`,
 * which deletes the row when Slack says the webhook is gone (app removed,
 * channel deleted). No accounts: the channel itself is the subscriber.
 */
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("team_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    workspaceName: text("workspace_name").notNull(),
    channelId: text("channel_id").notNull(),
    /** "#futbol", as Slack gives it. */
    channelName: text("channel_name").notNull(),
    /** When it wants each call-up (src/notify/schedule.ts): the last such weekday (1 Monday … 5 Friday) before the match. */
    notifyWeekday: integer("notify_weekday").notNull().default(4),
    /** At this Madrid time, "HH:00". */
    notifyTime: text("notify_time").notNull().default("10:00"),
    /** The Incoming Webhook URL, encrypted (src/notify/secrets.ts): whoever has it can post to the channel. */
    webhookUrl: text("webhook_url").notNull(),
    /** Madrid local time. */
    createdAt: text("created_at").notNull(),
  },
  // Subscribing the same channel to the same team again replaces its webhook.
  (t) => [uniqueIndex("subscriptions_team_channel").on(t.teamId, t.workspaceId, t.channelId)],
);

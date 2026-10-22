CREATE TABLE `leagues` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`parent_id` integer
);
--> statement-breakpoint
CREATE TABLE `match_players` (
	`match_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`number` text,
	`position` text,
	`goals` integer NOT NULL,
	`minutes` text NOT NULL,
	`assists` integer NOT NULL,
	`yellow_cards` integer NOT NULL,
	`red_cards` integer NOT NULL,
	`crack` integer NOT NULL,
	`dandy` integer NOT NULL,
	`points` real NOT NULL,
	PRIMARY KEY(`match_id`, `player_id`)
);
--> statement-breakpoint
CREATE INDEX `match_players_player` ON `match_players` (`player_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`round` integer,
	`season_id` integer,
	`home_id` integer NOT NULL,
	`away_id` integer NOT NULL,
	`home_name` text NOT NULL,
	`away_name` text NOT NULL,
	`home_goals` integer,
	`away_goals` integer,
	`played` integer NOT NULL,
	`league_ids` text NOT NULL,
	`group_id` integer,
	`competition_id` integer,
	`venue_id` integer,
	`photos` text NOT NULL,
	`modified` text
);
--> statement-breakpoint
CREATE INDEX `matches_season` ON `matches` (`season_id`,`date`);--> statement-breakpoint
CREATE INDEX `matches_group` ON `matches` (`group_id`,`season_id`);--> statement-breakpoint
CREATE INDEX `matches_home` ON `matches` (`home_id`);--> statement-breakpoint
CREATE INDEX `matches_away` ON `matches` (`away_id`);--> statement-breakpoint
CREATE TABLE `news` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text,
	`name` text NOT NULL,
	`photo_url` text
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `squad_players` (
	`team_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`number` text,
	`position` text,
	`appearances` integer NOT NULL,
	`goals` integer NOT NULL,
	`assists` integer NOT NULL,
	`mvp_points` real NOT NULL,
	`market_value` real NOT NULL,
	`crack` integer NOT NULL,
	`dandy` integer NOT NULL,
	PRIMARY KEY(`team_id`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`photo_url` text,
	`youtube_url` text,
	`youtube_title` text,
	`youtube_thumbnail_url` text,
	`flickr_album_url` text,
	`season_ids` text NOT NULL,
	`league_ids` text NOT NULL,
	`list_ids` text NOT NULL,
	`modified` text,
	`detail_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `teams_slug` ON `teams` (`slug`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`season_id` integer,
	`competition_id` integer,
	`winner_id` integer
);

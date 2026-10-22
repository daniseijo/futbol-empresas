PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_match_players` (
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
	PRIMARY KEY(`match_id`, `team_id`, `player_id`)
);
--> statement-breakpoint
INSERT INTO `__new_match_players`("match_id", "player_id", "team_id", "number", "position", "goals", "minutes", "assists", "yellow_cards", "red_cards", "crack", "dandy", "points") SELECT "match_id", "player_id", "team_id", "number", "position", "goals", "minutes", "assists", "yellow_cards", "red_cards", "crack", "dandy", "points" FROM `match_players`;--> statement-breakpoint
DROP TABLE `match_players`;--> statement-breakpoint
ALTER TABLE `__new_match_players` RENAME TO `match_players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `match_players_player` ON `match_players` (`player_id`);
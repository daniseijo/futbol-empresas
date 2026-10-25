CREATE TABLE `notifications` (
	`match_id` integer NOT NULL,
	`channel` text NOT NULL,
	`fingerprint` text NOT NULL,
	`sent_at` text NOT NULL,
	PRIMARY KEY(`match_id`, `channel`)
);

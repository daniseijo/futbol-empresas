ALTER TABLE `players` ADD `last_team_id` integer;--> statement-breakpoint
ALTER TABLE `players` ADD `last_match_date` text;--> statement-breakpoint
-- Filled once here (about 530,000 rows read); from now on the sync keeps them up to date without reading lineups
-- (see recordLatestTeams in src/sync/run.ts).
UPDATE `players` SET (`last_team_id`, `last_match_date`) = (
  SELECT `mp`.`team_id`, `m`.`date` FROM `match_players` `mp` JOIN `matches` `m` ON `m`.`id` = `mp`.`match_id`
  WHERE `mp`.`player_id` = `players`.`id` ORDER BY `m`.`date` DESC, `m`.`id` DESC LIMIT 1
);--> statement-breakpoint
-- Players who have not played yet: their squad's team.
UPDATE `players` SET `last_team_id` = (SELECT `team_id` FROM `squad_players` WHERE `player_id` = `players`.`id` LIMIT 1)
WHERE `last_team_id` IS NULL;

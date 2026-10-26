ALTER TABLE `subscriptions` ADD `notify_weekday` integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `notify_time` text DEFAULT '10:00' NOT NULL;
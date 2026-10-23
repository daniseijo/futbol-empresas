-- Sync progress keys were renamed from Spanish to English; keep the progress already made.
UPDATE `sync_state` SET `key` = 'changes' WHERE `key` = 'cambios';--> statement-breakpoint
UPDATE `sync_state` SET `key` = 'backfill:teams' WHERE `key` = 'carga:equipos';--> statement-breakpoint
UPDATE `sync_state` SET `key` = 'backfill:tournaments' WHERE `key` = 'carga:torneos';--> statement-breakpoint
UPDATE `sync_state` SET `key` = 'backfill:matches:' || substr(`key`, length('carga:partidos:') + 1) WHERE `key` LIKE 'carga:partidos:%';--> statement-breakpoint
UPDATE `sync_state` SET `value` = 'done' WHERE `value` = 'hecho';

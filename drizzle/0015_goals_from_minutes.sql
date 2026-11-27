-- The match sheet sometimes lists a scorer's minutes without the count (" (29')"),
-- which the sync used to store as 0 goals. Count the minutes for those rows.
UPDATE `match_players` SET `goals` = json_array_length(`minutes`) WHERE `goals` < json_array_length(`minutes`);

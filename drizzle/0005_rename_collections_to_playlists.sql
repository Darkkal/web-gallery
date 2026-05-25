-- Rename tables
ALTER TABLE `collections` RENAME TO `playlists`;
--> statement-breakpoint
ALTER TABLE `collection_items` RENAME TO `playlist_items`;
--> statement-breakpoint
ALTER TABLE `playlist_items` RENAME COLUMN `collection_id` TO `playlist_id`;
--> statement-breakpoint
ALTER TABLE `playlists` ADD COLUMN `thumbnail` text;
--> statement-breakpoint
ALTER TABLE `playlists` ADD COLUMN `updated_at` integer;
--> statement-breakpoint
ALTER TABLE `playlist_items` ADD COLUMN `position` integer NOT NULL DEFAULT 0;
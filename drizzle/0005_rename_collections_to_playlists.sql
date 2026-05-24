-- Rename tables
ALTER TABLE `collections` RENAME TO `playlists`;
ALTER TABLE `collection_items` RENAME TO `playlist_items`;

-- Rename column inside the items table
ALTER TABLE `playlist_items` RENAME COLUMN `collection_id` TO `playlist_id`;

-- Add new metadata and ordering columns
ALTER TABLE `playlists` ADD COLUMN `thumbnail` text;
ALTER TABLE `playlists` ADD COLUMN `updated_at` integer;
ALTER TABLE `playlist_items` ADD COLUMN `position` integer NOT NULL DEFAULT 0;
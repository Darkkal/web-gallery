ALTER TABLE `playlists` ADD `type` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `playlists` ADD `search_query` text;

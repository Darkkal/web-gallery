ALTER TABLE `collection_items` RENAME TO `playlist_items`;--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`thumbnail` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
DROP TABLE `collections`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_playlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` integer NOT NULL,
	`media_item_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`added_at` integer,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_playlist_items`("id", "playlist_id", "media_item_id", "position", "added_at") SELECT "id", "playlist_id", "media_item_id", "position", "added_at" FROM `playlist_items`;--> statement-breakpoint
DROP TABLE `playlist_items`;--> statement-breakpoint
ALTER TABLE `__new_playlist_items` RENAME TO `playlist_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `media_items` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `media_items` ADD `height` integer;
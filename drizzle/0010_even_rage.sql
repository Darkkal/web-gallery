CREATE TABLE `library_statistics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`total_posts` integer DEFAULT 0 NOT NULL,
	`total_media_items` integer DEFAULT 0 NOT NULL,
	`total_tags` integer DEFAULT 0 NOT NULL,
	`total_users` integer DEFAULT 0 NOT NULL,
	`total_extractors` integer DEFAULT 0 NOT NULL,
	`storage_bytes` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statistics_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`date_type` text DEFAULT 'import' NOT NULL,
	`total_posts` integer DEFAULT 0 NOT NULL,
	`total_media_items` integer DEFAULT 0 NOT NULL,
	`total_tags` integer DEFAULT 0 NOT NULL,
	`total_users` integer DEFAULT 0 NOT NULL,
	`total_extractors` integer DEFAULT 0 NOT NULL,
	`storage_bytes` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_statistics_history_date` ON `statistics_history` (`date`,`date_type`);--> statement-breakpoint
ALTER TABLE `posts` ADD `is_source_deleted` integer DEFAULT false;
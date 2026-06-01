CREATE TABLE `library_statistics` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `total_posts` integer NOT NULL DEFAULT 0,
  `total_media_items` integer NOT NULL DEFAULT 0,
  `total_tags` integer NOT NULL DEFAULT 0,
  `total_users` integer NOT NULL DEFAULT 0,
  `total_extractors` integer NOT NULL DEFAULT 0,
  `storage_bytes` integer NOT NULL DEFAULT 0,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statistics_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `date` text NOT NULL,
  `date_type` text NOT NULL DEFAULT 'import',
  `total_posts` integer NOT NULL DEFAULT 0,
  `total_media_items` integer NOT NULL DEFAULT 0,
  `total_tags` integer NOT NULL DEFAULT 0,
  `total_users` integer NOT NULL DEFAULT 0,
  `total_extractors` integer NOT NULL DEFAULT 0,
  `storage_bytes` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_statistics_history_date` ON `statistics_history` (`date`, `date_type`);

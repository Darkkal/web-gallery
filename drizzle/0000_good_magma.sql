CREATE TABLE `collection_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_id` integer NOT NULL,
	`media_item_id` integer NOT NULL,
	`added_at` integer,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `gallerydl_extractor_types` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_path` text NOT NULL,
	`media_type` text DEFAULT 'image',
	`captured_at` integer,
	`created_at` integer,
	`post_id` integer,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `pixiv_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`account` text,
	`profile_image` text,
	`is_followed` integer,
	`is_accept_request` integer
);
--> statement-breakpoint
CREATE TABLE `post_details_gelbooruv02` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`rating` text,
	`score` integer,
	`md5` text,
	`width` integer,
	`height` integer,
	`tags` text,
	`directory` text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_details_pixiv` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`width` integer,
	`height` integer,
	`page_count` integer,
	`restrict` integer,
	`x_restrict` integer,
	`sanity_level` integer,
	`total_view` integer,
	`total_bookmarks` integer,
	`is_bookmarked` integer,
	`visible` integer,
	`is_muted` integer,
	`illust_ai_type` integer,
	`illust_book_style` integer,
	`tags` text,
	`category` text,
	`subcategory` text,
	`type` text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_details_twitter` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`retweet_id` text,
	`quote_id` text,
	`reply_id` text,
	`conversation_id` text,
	`lang` text,
	`source` text,
	`sensitive` integer,
	`sensitive_flags` text,
	`favorite_count` integer,
	`quote_count` integer,
	`reply_count` integer,
	`retweet_count` integer,
	`bookmark_count` integer,
	`view_count` integer,
	`category` text,
	`subcategory` text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_tags` (
	`tag_id` integer NOT NULL,
	`post_id` integer NOT NULL,
	PRIMARY KEY(`tag_id`, `post_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`extractor_type` text NOT NULL,
	`json_source_id` text,
	`internal_source_id` integer,
	`user_id` text,
	`date` text,
	`title` text,
	`content` text,
	`url` text,
	`metadata_path` text,
	`created_at` integer,
	FOREIGN KEY (`internal_source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scan_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`status` text NOT NULL,
	`files_processed` integer DEFAULT 0,
	`files_added` integer DEFAULT 0,
	`files_updated` integer DEFAULT 0,
	`files_deleted` integer DEFAULT 0,
	`errors` integer DEFAULT 0,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `scrape_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`status` text NOT NULL,
	`files_downloaded` integer DEFAULT 0,
	`bytes_downloaded` integer DEFAULT 0,
	`error_count` integer DEFAULT 0,
	`skipped_count` integer DEFAULT 0,
	`posts_processed` integer DEFAULT 0,
	`average_speed` integer DEFAULT 0,
	`last_error` text,
	`task_id` integer,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `scraping_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `scraper_download_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scraper_download_logs_file_path_unique` ON `scraper_download_logs` (`file_path`);--> statement-breakpoint
CREATE TABLE `scraping_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`name` text,
	`download_options` text,
	`schedule_interval` integer,
	`next_run_at` integer,
	`last_run_at` integer,
	`enabled` integer DEFAULT true,
	`created_at` integer,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`extractor_type` text,
	`name` text,
	`created_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`extractor_type`) REFERENCES `gallerydl_extractor_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `twitter_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`nick` text,
	`location` text,
	`date` text,
	`verified` integer,
	`protected` integer,
	`profile_banner` text,
	`profile_image` text,
	`favourites_count` integer,
	`followers_count` integer,
	`friends_count` integer,
	`listed_count` integer,
	`media_count` integer,
	`statuses_count` integer,
	`description` text
);

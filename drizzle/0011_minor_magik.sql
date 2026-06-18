CREATE INDEX `idx_media_items_post_id` ON `media_items` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_playlist_items_playlist_id` ON `playlist_items` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `idx_playlist_items_media_item_id` ON `playlist_items` (`media_item_id`);--> statement-breakpoint
CREATE INDEX `idx_post_details_gelbooruv02_post_id` ON `post_details_gelbooruv02` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_post_details_pixiv_post_id` ON `post_details_pixiv` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_post_details_twitter_post_id` ON `post_details_twitter` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_post_tags_post_id` ON `post_tags` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_internal_source_id` ON `posts` (`internal_source_id`);--> statement-breakpoint
CREATE INDEX `idx_scrape_history_source_id` ON `scrape_history` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_scrape_history_task_id` ON `scrape_history` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_scraper_download_logs_source_id` ON `scraper_download_logs` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_scraping_tasks_source_id` ON `scraping_tasks` (`source_id`);
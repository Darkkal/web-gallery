ALTER TABLE `library_statistics` ADD `total_canonical_tags` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `statistics_history` ADD `total_canonical_tags` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tags` ADD `alias_of_tag_id` integer REFERENCES tags(id);
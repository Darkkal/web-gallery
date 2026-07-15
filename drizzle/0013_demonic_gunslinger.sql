CREATE TABLE `tag_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color_hue` integer NOT NULL,
	`color_saturation` integer NOT NULL,
	`color_lightness` integer NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_categories_name_unique` ON `tag_categories` (`name`);--> statement-breakpoint
ALTER TABLE `tags` ADD `category_id` integer REFERENCES tag_categories(id);
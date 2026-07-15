CREATE TABLE `tag_relations` (
	`tag_id` integer NOT NULL,
	`related_tag_id` integer NOT NULL,
	PRIMARY KEY(`tag_id`, `related_tag_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tag_relation_check" CHECK("tag_relations"."tag_id" < "tag_relations"."related_tag_id")
);

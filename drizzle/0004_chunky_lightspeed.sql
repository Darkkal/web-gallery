ALTER TABLE `posts` ADD `deleted_at` integer;
--> statement-breakpoint
UPDATE posts SET deleted_at = (strftime('%s', 'now') * 1000) WHERE id IN (
  SELECT p.id FROM posts p
  JOIN post_details_pixiv pd ON p.id = pd.post_id
  WHERE pd.visible = 0 AND (p.title = '' OR p.title IS NULL) AND (p.content = '' OR p.content IS NULL)
);
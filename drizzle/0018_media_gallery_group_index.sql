CREATE INDEX `idx_media_items_gallery_group` ON `media_items` (COALESCE(`post_id`, -`id`));

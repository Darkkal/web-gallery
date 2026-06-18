CREATE TABLE `post_details_ehentai` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`gid` integer,
	`token` text,
	`eh_category` text,
	`uploader` text,
	`language` text,
	`file_count` integer,
	`rating` text,
	`torrent_count` integer,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_post_details_ehentai_post_id` ON `post_details_ehentai` (`post_id`);
--> statement-breakpoint
-- Drop old triggers
DROP TRIGGER IF EXISTS posts_ai;
--> statement-breakpoint
DROP TRIGGER IF EXISTS posts_au;
--> statement-breakpoint
DROP TRIGGER IF EXISTS post_tags_ai;
--> statement-breakpoint
DROP TRIGGER IF EXISTS post_tags_ad;
--> statement-breakpoint
-- Create updated triggers
CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names) 
  VALUES (
    new.id, 
    new.title, 
    new.content,
    COALESCE(
      (SELECT name FROM twitter_users WHERE id = new.user_id AND new.extractor_type = 'twitter'),
      (SELECT name FROM pixiv_users WHERE id = new.user_id AND new.extractor_type = 'pixiv'),
      CASE WHEN new.extractor_type IN ('ehentai', 'exhentai') THEN new.user_id ELSE '' END
    ),
    COALESCE(
      (SELECT nick FROM twitter_users WHERE id = new.user_id AND new.extractor_type = 'twitter'),
      (SELECT account FROM pixiv_users WHERE id = new.user_id AND new.extractor_type = 'pixiv'),
      CASE WHEN new.extractor_type IN ('ehentai', 'exhentai') THEN new.user_id ELSE '' END
    ),
    COALESCE((SELECT name FROM sources WHERE id = new.internal_source_id), ''),
    ''
  );
END;
--> statement-breakpoint
CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content, user_name, user_handle, source_name, tag_names) 
  VALUES ('delete', old.id, old.title, old.content, '', '', '', '');
  INSERT INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names) 
  VALUES (
    new.id, 
    new.title, 
    new.content,
    COALESCE(
      (SELECT name FROM twitter_users WHERE id = new.user_id AND new.extractor_type = 'twitter'),
      (SELECT name FROM pixiv_users WHERE id = new.user_id AND new.extractor_type = 'pixiv'),
      CASE WHEN new.extractor_type IN ('ehentai', 'exhentai') THEN new.user_id ELSE '' END
    ),
    COALESCE(
      (SELECT nick FROM twitter_users WHERE id = new.user_id AND new.extractor_type = 'twitter'),
      (SELECT account FROM pixiv_users WHERE id = new.user_id AND new.extractor_type = 'pixiv'),
      CASE WHEN new.extractor_type IN ('ehentai', 'exhentai') THEN new.user_id ELSE '' END
    ),
    COALESCE((SELECT name FROM sources WHERE id = new.internal_source_id), ''),
    COALESCE((SELECT group_concat(t.name, ' ') FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = new.id), '')
  );
END;
--> statement-breakpoint
CREATE TRIGGER post_tags_ai AFTER INSERT ON post_tags BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content, user_name, user_handle, source_name, tag_names)
  VALUES ('delete', new.post_id, (SELECT title FROM posts WHERE id = new.post_id), (SELECT content FROM posts WHERE id = new.post_id), '', '', '', '');
  
  INSERT INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names)
  SELECT 
    p.id, 
    p.title, 
    p.content,
    COALESCE(
      tu.name, 
      pu.name, 
      CASE WHEN p.extractor_type IN ('ehentai', 'exhentai') THEN p.user_id ELSE '' END
    ), 
    COALESCE(
      tu.nick, 
      pu.account, 
      CASE WHEN p.extractor_type IN ('ehentai', 'exhentai') THEN p.user_id ELSE '' END
    ), 
    COALESCE(s.name, ''),
    COALESCE((SELECT group_concat(t.name, ' ') FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id), '')
  FROM posts p
    LEFT JOIN twitter_users tu ON p.extractor_type = 'twitter' AND p.user_id = tu.id
    LEFT JOIN pixiv_users pu ON p.extractor_type = 'pixiv' AND p.user_id = pu.id
    LEFT JOIN sources s ON p.internal_source_id = s.id
  WHERE p.id = new.post_id;
END;
--> statement-breakpoint
CREATE TRIGGER post_tags_ad AFTER DELETE ON post_tags BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content, user_name, user_handle, source_name, tag_names)
  VALUES ('delete', old.post_id, (SELECT title FROM posts WHERE id = old.post_id), (SELECT content FROM posts WHERE id = old.post_id), '', '', '', '');
  
  INSERT INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names)
  SELECT 
    p.id, 
    p.title, 
    p.content,
    COALESCE(
      tu.name, 
      pu.name, 
      CASE WHEN p.extractor_type IN ('ehentai', 'exhentai') THEN p.user_id ELSE '' END
    ), 
    COALESCE(
      tu.nick, 
      pu.account, 
      CASE WHEN p.extractor_type IN ('ehentai', 'exhentai') THEN p.user_id ELSE '' END
    ), 
    COALESCE(s.name, ''),
    COALESCE((SELECT group_concat(t.name, ' ') FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id), '')
  FROM posts p
    LEFT JOIN twitter_users tu ON p.extractor_type = 'twitter' AND p.user_id = tu.id
    LEFT JOIN pixiv_users pu ON p.extractor_type = 'pixiv' AND p.user_id = pu.id
    LEFT JOIN sources s ON p.internal_source_id = s.id
  WHERE p.id = old.post_id;
END;
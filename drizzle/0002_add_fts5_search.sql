-- Create the FTS5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  title, 
  content, 
  user_name, 
  user_handle, 
  source_name, 
  tag_names,
  content=posts,
  content_rowid=id,
  tokenize='unicode61 remove_diacritics 1'
);

--> statement-breakpoint
-- Populate the FTS5 table with existing data
INSERT OR IGNORE INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names)
SELECT 
  p.id, 
  p.title, 
  p.content,
  COALESCE(tu.name, pu.name, ''), 
  COALESCE(tu.nick, pu.account, ''), 
  COALESCE(s.name, ''),
  COALESCE((SELECT group_concat(t.name, ' ') FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id), '')
FROM posts p
  LEFT JOIN twitter_users tu ON p.extractor_type = 'twitter' AND p.user_id = tu.id
  LEFT JOIN pixiv_users pu ON p.extractor_type = 'pixiv' AND p.user_id = pu.id
  LEFT JOIN sources s ON p.internal_source_id = s.id;

--> statement-breakpoint
-- Triggers to keep posts_fts in sync with posts inserts
CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names) 
  VALUES (
    new.id, 
    new.title, 
    new.content,
    COALESCE((SELECT name FROM twitter_users WHERE id = new.user_id AND new.extractor_type = 'twitter'), (SELECT name FROM pixiv_users WHERE id = new.user_id AND new.extractor_type = 'pixiv'), ''),
    COALESCE((SELECT nick FROM twitter_users WHERE id = new.user_id AND new.extractor_type = 'twitter'), (SELECT account FROM pixiv_users WHERE id = new.user_id AND new.extractor_type = 'pixiv'), ''),
    COALESCE((SELECT name FROM sources WHERE id = new.internal_source_id), ''),
    ''
  );
END;

--> statement-breakpoint
-- Triggers to keep posts_fts in sync with posts deletes
CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content, user_name, user_handle, source_name, tag_names) 
  VALUES ('delete', old.id, old.title, old.content, '', '', '', '');
END;

--> statement-breakpoint
-- Triggers to keep posts_fts in sync with posts updates
CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content, user_name, user_handle, source_name, tag_names) 
  VALUES ('delete', old.id, old.title, old.content, '', '', '', '');
  INSERT INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names) 
  VALUES (
    new.id, 
    new.title, 
    new.content,
    COALESCE((SELECT name FROM twitter_users WHERE id = new.user_id AND new.extractor_type = 'twitter'), (SELECT name FROM pixiv_users WHERE id = new.user_id AND new.extractor_type = 'pixiv'), ''),
    COALESCE((SELECT nick FROM twitter_users WHERE id = new.user_id AND new.extractor_type = 'twitter'), (SELECT account FROM pixiv_users WHERE id = new.user_id AND new.extractor_type = 'pixiv'), ''),
    COALESCE((SELECT name FROM sources WHERE id = new.internal_source_id), ''),
    COALESCE((SELECT group_concat(t.name, ' ') FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = new.id), '')
  );
END;

--> statement-breakpoint
-- Triggers for tag insertions
CREATE TRIGGER IF NOT EXISTS post_tags_ai AFTER INSERT ON post_tags BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content, user_name, user_handle, source_name, tag_names)
  VALUES ('delete', new.post_id, (SELECT title FROM posts WHERE id = new.post_id), (SELECT content FROM posts WHERE id = new.post_id), '', '', '', '');
  
  INSERT INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names)
  SELECT 
    p.id, 
    p.title, 
    p.content,
    COALESCE(tu.name, pu.name, ''), 
    COALESCE(tu.nick, pu.account, ''), 
    COALESCE(s.name, ''),
    COALESCE((SELECT group_concat(t.name, ' ') FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id), '')
  FROM posts p
    LEFT JOIN twitter_users tu ON p.extractor_type = 'twitter' AND p.user_id = tu.id
    LEFT JOIN pixiv_users pu ON p.extractor_type = 'pixiv' AND p.user_id = pu.id
    LEFT JOIN sources s ON p.internal_source_id = s.id
  WHERE p.id = new.post_id;
END;

--> statement-breakpoint
-- Triggers for tag deletions
CREATE TRIGGER IF NOT EXISTS post_tags_ad AFTER DELETE ON post_tags BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content, user_name, user_handle, source_name, tag_names)
  VALUES ('delete', old.post_id, (SELECT title FROM posts WHERE id = old.post_id), (SELECT content FROM posts WHERE id = old.post_id), '', '', '', '');
  
  INSERT INTO posts_fts(rowid, title, content, user_name, user_handle, source_name, tag_names)
  SELECT 
    p.id, 
    p.title, 
    p.content,
    COALESCE(tu.name, pu.name, ''), 
    COALESCE(tu.nick, pu.account, ''), 
    COALESCE(s.name, ''),
    COALESCE((SELECT group_concat(t.name, ' ') FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id), '')
  FROM posts p
    LEFT JOIN twitter_users tu ON p.extractor_type = 'twitter' AND p.user_id = tu.id
    LEFT JOIN pixiv_users pu ON p.extractor_type = 'pixiv' AND p.user_id = pu.id
    LEFT JOIN sources s ON p.internal_source_id = s.id
  WHERE p.id = old.post_id;
END;

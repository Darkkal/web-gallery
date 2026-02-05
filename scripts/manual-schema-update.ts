
import Database from 'better-sqlite3';

const sqlite = new Database('sqlite.db');

console.log("Applying manual schema updates...");

// 1. Create posts table
sqlite.prepare(`
CREATE TABLE IF NOT EXISTS "posts" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"extractor_type" text NOT NULL,
	"json_source_id" text,
	"internal_source_id" integer,
	"user_id" text,
	"date" text,
	"title" text,
	"content" text,
	"url" text,
	"metadata_path" text,
	"created_at" integer,
	FOREIGN KEY ("internal_source_id") REFERENCES "sources"("id") ON UPDATE no action ON DELETE no action
);
`).run();

// 2. Create detail tables
sqlite.prepare(`
CREATE TABLE IF NOT EXISTS "post_details_twitter" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"post_id" integer NOT NULL,
	"retweet_id" text,
	"quote_id" text,
	"reply_id" text,
	"conversation_id" text,
	"lang" text,
	"source" text,
	"sensitive" integer,
	"sensitive_flags" text,
	"favorite_count" integer,
	"quote_count" integer,
	"reply_count" integer,
	"retweet_count" integer,
	"bookmark_count" integer,
	"view_count" integer,
	"category" text,
	"subcategory" text,
	FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON UPDATE no action ON DELETE cascade
);
`).run();

sqlite.prepare(`
CREATE TABLE IF NOT EXISTS "post_details_pixiv" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"post_id" integer NOT NULL,
	"width" integer,
	"height" integer,
	"page_count" integer,
	"restrict" integer,
	"x_restrict" integer,
	"sanity_level" integer,
	"total_view" integer,
	"total_bookmarks" integer,
	"is_bookmarked" integer,
	"visible" integer,
	"is_muted" integer,
	"illust_ai_type" integer,
	"illust_book_style" integer,
	"tags" text,
	"category" text,
	"subcategory" text,
	"type" text,
	FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON UPDATE no action ON DELETE cascade
);
`).run();

sqlite.prepare(`
CREATE TABLE IF NOT EXISTS "post_details_gelbooruv02" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"post_id" integer NOT NULL,
	"rating" text,
	"score" integer,
	"md5" text,
	"width" integer,
	"height" integer,
	"tags" text,
	"directory" text,
	FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON UPDATE no action ON DELETE cascade
);
`).run();

sqlite.prepare(`
CREATE TABLE IF NOT EXISTS "post_tags_new" (
	"tag_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	PRIMARY KEY("tag_id", "post_id"),
	FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON UPDATE no action ON DELETE cascade
);
`).run();

// 3. Alter existing tables
try {
	sqlite.prepare(`ALTER TABLE "media_items" ADD COLUMN "post_id" integer REFERENCES "posts"("id") ON DELETE SET NULL;`).run();
	console.log("Added post_id to media_items");
} catch (e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	if (!msg.includes('duplicate column name')) console.error("Error altering media_items:", msg);
}

try {
	sqlite.prepare(`ALTER TABLE "twitter_post_details" RENAME TO "post_details_twitter";`).run();
	console.log("Renamed twitter_post_details to post_details_twitter");
} catch (e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	if (!msg.includes('no such table')) console.error("Error renaming twitter_post_details:", msg);
}

try {
	sqlite.prepare(`ALTER TABLE "pixiv_post_details" RENAME TO "post_details_pixiv";`).run();
	console.log("Renamed pixiv_post_details to post_details_pixiv");
} catch (e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	if (!msg.includes('no such table')) console.error("Error renaming pixiv_post_details:", msg);
}

try {
	sqlite.prepare(`ALTER TABLE "gelbooruv02_post_details" RENAME TO "post_details_gelbooruv02";`).run();
	console.log("Renamed gelbooruv02_post_details to post_details_gelbooruv02");
} catch (e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	if (!msg.includes('no such table')) console.error("Error renaming gelbooruv02_post_details:", msg);
}

try {
	sqlite.prepare(`ALTER TABLE "post_tags" RENAME TO "post_tags_old";`).run();
	sqlite.prepare(`ALTER TABLE "post_tags_new" RENAME TO "post_tags";`).run();
	console.log("Renamed post_tags_new to post_tags");
} catch (e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	console.error("Error renaming post_tags:", msg);
}

try {
	sqlite.prepare(`DROP TABLE IF EXISTS "twitter_tweets";`).run();
	sqlite.prepare(`DROP TABLE IF EXISTS "pixiv_illusts";`).run();
	sqlite.prepare(`DROP TABLE IF EXISTS "post_tags_old";`).run();
	sqlite.prepare(`DROP TABLE IF EXISTS "twitter_post_details";`).run();
	sqlite.prepare(`DROP TABLE IF EXISTS "pixiv_post_details";`).run();
	sqlite.prepare(`DROP TABLE IF EXISTS "gelbooruv02_post_details";`).run();
	console.log("Dropped legacy tables");
} catch (e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	console.error("Error dropping legacy tables:", msg);
}

try {
	// SQLite 3.35.0+ supports DROP COLUMN. 
	// If it fails, it might be an older version, but let's try.
	sqlite.prepare(`ALTER TABLE "media_items" DROP COLUMN "extractor_type";`).run();
	sqlite.prepare(`ALTER TABLE "media_items" DROP COLUMN "internal_post_id";`).run();
	console.log("Dropped legacy columns from media_items");
} catch (e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	if (!msg.includes('no such column')) console.error("Error dropping columns from media_items:", msg);
}

try {
	sqlite.prepare(`ALTER TABLE "posts" ADD COLUMN "metadata_path" text;`).run();
	console.log("Added metadata_path to posts");
} catch (e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	if (!msg.includes('duplicate column name')) console.error("Error altering posts:", msg);
}

// 4. Cleanup redundant JSON media items
try {
	const cleanup = sqlite.prepare(`DELETE FROM media_items WHERE file_path LIKE '%.json'`).run();
	console.log(`Cleaned up ${cleanup.changes} redundant JSON entries from media_items`);
} catch (e: unknown) {
	console.error("Error during cleanup:", e);
}

console.log("Manual schema update completed.");

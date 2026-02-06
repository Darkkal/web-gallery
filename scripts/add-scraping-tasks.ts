import Database from 'better-sqlite3';

const sqlite = new Database('sqlite.db');

console.log("Applying scraping tasks schema update...");

// 1. Create scraping_tasks table
sqlite.prepare(`
CREATE TABLE IF NOT EXISTS "scraping_tasks" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "source_id" integer NOT NULL,
    "name" text,
    "download_options" text,
    "schedule_interval" integer,
    "next_run_at" integer,
    "last_run_at" integer,
    "enabled" integer DEFAULT 1,
    "created_at" integer,
    FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON UPDATE no action ON DELETE no action
);
`).run();

// 2. Alter scrape_history table
try {
    sqlite.prepare(`ALTER TABLE "scrape_history" ADD COLUMN "task_id" integer REFERENCES "scraping_tasks"("id");`).run();
    console.log("Added task_id to scrape_history");
} catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column name')) console.error("Error adding task_id:", msg);
}

try {
    sqlite.prepare(`ALTER TABLE "scrape_history" ADD COLUMN "skipped_count" integer DEFAULT 0;`).run();
    console.log("Added skipped_count to scrape_history");
} catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column name')) console.error("Error adding skipped_count:", msg);
}

console.log("Schema update completed.");

// 3. Alter scrape_history table for posts_processed
try {
    sqlite.prepare(`ALTER TABLE "scrape_history" ADD COLUMN "posts_processed" integer DEFAULT 0;`).run();
    console.log("Added posts_processed to scrape_history");
} catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column name')) console.error("Error adding posts_processed:", msg);
}

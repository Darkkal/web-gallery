import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";

const MIGRATIONS_TABLE = "__drizzle_migrations";
const migrationsFolder = path.join(process.cwd(), "drizzle");

interface MigrationEntry {
  tag: string;
  when: number;
}

interface Journal {
  entries: MigrationEntry[];
}

function readMigrationMeta(): {
  sql: string;
  hash: string;
  folderMillis: number;
}[] {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) return [];

  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  const migrations: { sql: string; hash: string; folderMillis: number }[] = [];

  for (const entry of journal.entries) {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) continue;

    const sql = fs.readFileSync(sqlPath, "utf-8");
    migrations.push({
      sql,
      hash: createHash("sha256").update(sql).digest("hex"),
      folderMillis: entry.when,
    });
  }

  return migrations;
}

export function setupTestDb() {
  const client = createClient({ url: "file::memory:" });
  const db = drizzle(client, { schema });

  async function runMigrations() {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER
      )
    `);

    const migrations = readMigrationMeta();
    for (const migration of migrations) {
      const statements = migration.sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        try {
          await client.execute(stmt);
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          if (
            msg.includes("already exists") ||
            msg.includes("duplicate column name") ||
            msg.includes("no such table") ||
            msg.includes("no such column")
          ) {
            // Skip already-applied migration statements
          } else {
            throw error;
          }
        }
      }

      await client.execute({
        sql: `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
        args: [migration.hash, String(migration.folderMillis)],
      });
    }
  }

  async function clearDb() {
    await client.execute("PRAGMA foreign_keys = OFF");

    const tables = [
      "post_tags",
      "tags",
      "playlist_items",
      "playlists",
      "media_items",
      "post_details_twitter",
      "post_details_pixiv",
      "post_details_gelbooruv02",
      "post_details_ehentai",
      "posts",
      "twitter_users",
      "pixiv_users",
      "scan_history",
      "scrape_history",
      "scraping_tasks",
      "scraper_download_logs",
      "sources",
      "gallerydl_extractor_types",
      "library_statistics",
      "statistics_history",
    ];

    for (const table of tables) {
      try {
        await client.execute(`DELETE FROM ${table}`);
      } catch (_e) {
        // Table might not exist yet or delete failed
      }
    }

    await client.execute("PRAGMA foreign_keys = ON");
  }

  return {
    client,
    db,
    runMigrations,
    clearDb,
  };
}

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const dbPath = path.join(process.cwd(), 'sqlite.db');
const dbUrl = process.env.DATABASE_URL ?? `file:${dbPath}`;

const client = createClient({ url: dbUrl });
export const db = drizzle(client, { schema });

const MIGRATIONS_TABLE = '__drizzle_migrations';
const migrationsFolder = path.join(process.cwd(), 'drizzle');

interface MigrationEntry {
    tag: string;
    when: number;
    breakpoints: boolean;
}

interface Journal {
    version: string;
    dialect: string;
    entries: MigrationEntry[];
}

/**
 * Reads migration metadata from the journal and SQL files,
 * matching what drizzle-orm's `readMigrationFiles()` produces.
 */
function readMigrationMeta(): { sql: string; hash: string; folderMillis: number }[] {
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
    if (!fs.existsSync(journalPath)) return [];

    const journal: Journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    const migrations: { sql: string; hash: string; folderMillis: number }[] = [];

    for (const entry of journal.entries) {
        const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
        if (!fs.existsSync(sqlPath)) continue;

        const sql = fs.readFileSync(sqlPath, 'utf-8');
        migrations.push({
            sql,
            hash: createHash('sha256').update(sql).digest('hex'),
            folderMillis: entry.when,
        });
    }

    return migrations;
}

/**
 * Applies pending migrations one at a time, tolerating statements
 * that have already been applied (e.g. from a previous `drizzle-kit push`
 * database). This is safer than drizzle's built-in `migrate()` for
 * databases that may have been managed with `push` in the past.
 */
async function applyMigrations(): Promise<void> {
    // Ensure the migrations tracking table exists
    await client.execute(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT NOT NULL,
            created_at INTEGER
        )
    `);

    const migrations = readMigrationMeta();

    for (const migration of migrations) {
        // Check if this migration was already applied (by hash)
        const existing = await client.execute({
            sql: `SELECT id FROM ${MIGRATIONS_TABLE} WHERE hash = ?`,
            args: [migration.hash],
        });

        if (existing.rows.length > 0) continue;

        // Split on drizzle's statement breakpoint marker
        const statements = migration.sql
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const stmt of statements) {
            try {
                await client.execute(stmt);
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : String(error);
                // Tolerate "already exists" errors from prior push usage
                if (msg.includes('already exists') || msg.includes('duplicate column name')) {
                    console.log(`[DB] Skipping already-applied statement: ${stmt.substring(0, 80)}…`);
                } else {
                    throw error;
                }
            }
        }

        // Record the migration as applied
        await client.execute({
            sql: `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
            args: [migration.hash, String(migration.folderMillis)],
        });

        console.log(`[DB] Applied migration (timestamp: ${migration.folderMillis})`);
    }
}

/**
 * Initializes the database connection and applies any pending migrations.
 *
 * - Fresh database: all migrations run normally.
 * - Existing database (from `drizzle-kit push`): individual statements
 *   that fail with "already exists" / "duplicate column" are skipped,
 *   and the migration is marked as applied.
 *
 * Called once at boot via `src/instrumentation.ts`.
 */
export async function initDb(): Promise<void> {
    try {
        await applyMigrations();
        console.log('[DB] Database initialized successfully.');
    } catch (error) {
        console.error('[DB] Failed to initialize database:', error);
        throw error;
    }
}

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

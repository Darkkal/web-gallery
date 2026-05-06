import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
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

/**
 * Seeds the migration journal for databases previously managed with
 * `drizzle-kit push`. Marks all existing migrations as applied without
 * re-running their SQL, so `migrate()` skips them on the next call.
 */
async function seedMigrationJournal(): Promise<void> {
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
    if (!fs.existsSync(journalPath)) return;

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

    await client.execute(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT NOT NULL,
            created_at INTEGER
        )
    `);

    for (const entry of journal.entries) {
        const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
        if (!fs.existsSync(sqlPath)) continue;

        const sql = fs.readFileSync(sqlPath, 'utf-8');
        const hash = createHash('sha256').update(`${entry.tag}:${sql}`).digest('hex');

        await client.execute({
            sql: `INSERT OR IGNORE INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
            args: [hash, String(entry.when)],
        });
    }

    console.log(`[DB] Seeded migration journal with ${journal.entries.length} existing entries`);
}

/**
 * Initializes the database connection and applies any pending migrations.
 *
 * - Fresh database: all migrations run normally.
 * - Existing database (from `drizzle-kit push`): the migration journal is
 *   seeded first so the already-applied SQL is skipped.
 *
 * Called once at boot via `src/instrumentation.ts`.
 */
export async function initDb(): Promise<void> {
    try {
        const metaResult = await client.execute(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='${MIGRATIONS_TABLE}'`,
        );

        if (metaResult.rows.length === 0) {
            const tablesResult = await client.execute(
                `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
            );

            if (tablesResult.rows.length > 0) {
                console.log('[DB] Existing database detected — seeding migration journal…');
                await seedMigrationJournal();
            }
        }

        await migrate(db, { migrationsFolder });
        console.log('[DB] Database initialized successfully.');
    } catch (error) {
        console.error('[DB] Failed to initialize database:', error);
        throw error;
    }
}

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

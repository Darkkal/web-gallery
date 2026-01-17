import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const dbPath = path.join(process.cwd(), 'sqlite.db');

// Check if DB exists before opening it (which would create an empty file)
if (!fs.existsSync(dbPath)) {
    console.log('[DB] Database file not found. Initializing schema...');
    try {
        // Run drizzle-kit push to create the schema
        // We use 'npm run db:push' to leverage the script defined in package.json
        execSync('npm run db:push', { stdio: 'inherit' });
        console.log('[DB] Schema initialized successfully.');
    } catch (error) {
        console.error('[DB] Failed to initialize database schema:', error);
        // We might want to throw here, but let's allow it to proceed 
        // in case better-sqlite3 can at least open the file, though tables will be missing.
    }
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

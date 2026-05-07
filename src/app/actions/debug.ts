'use server';

import { db } from '@/lib/db';
import { scraperManager } from '@/lib/scrapers/manager';
import { stopScanning } from '@/lib/library/scanner';
import fs from 'fs/promises';
import path from 'path';
import { sql, is, getTableName } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { revalidatePath } from 'next/cache';
import * as schema from '@/lib/db/schema';

/**
 * Throws if called in a production environment.
 * All destructive debug actions must call this before proceeding.
 */
function assertNonProduction() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Debug actions are disabled in production');
    }
}

/**
 * All schema tables, derived automatically from the schema module.
 * New tables added to schema.ts are picked up without any changes here.
 *
 * Uses Drizzle's `is()` type guard to filter for SQLiteTable instances,
 * avoiding the need for a manually maintained hardcoded list.
 * Deletion order is irrelevant because FK checks are disabled beforehand.
 */
const allTables: SQLiteTable[] = Object.values(schema).filter(
    (value) => is(value, SQLiteTable)
);

async function stopAllActivities() {
    console.log('[debug] Stopping library scan...');
    stopScanning();

    console.log('[debug] Stopping active scrapes...');
    const activeStatues = scraperManager.getAllStatuses();
    for (const status of activeStatues) {
        scraperManager.stopScrape(status.sourceId);
    }

    // Wait a bit for processes to die and file locks to release
    await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function purgeDatabases() {
    assertNonProduction();

    console.log('[purgeDatabases] STARTING PURGE...');
    await stopAllActivities();

    // 2. Delete gallery-dl Archives
    const archiveFiles = [
        'gallery-dl-pixiv-archive.sqlite3',
        'gallery-dl-twitter-archive.sqlite3'
    ];

    for (const file of archiveFiles) {
        try {
            const filePath = path.join(process.cwd(), file);
            await fs.unlink(filePath);
            console.log(`[purgeDatabases] Deleted ${file}`);
        } catch (error) {
            console.log(`[purgeDatabases] Could not delete ${file} (might not exist):`, error);
        }
    }

    // 3. Truncate Main Database
    try {
        console.log('[purgeDatabases] Truncating main database tables...');

        // Disable Foreign Keys
        await db.run(sql`PRAGMA foreign_keys = OFF`);

        // Delete from each table using the type-safe list
        for (const table of allTables) {
            console.log(`[purgeDatabases] Clearing table: ${getTableName(table)}`);
            await db.delete(table);
        }

        // Reset Sequence
        try {
            await db.run(sql`DELETE FROM sqlite_sequence`);
        } catch { }

        // Re-enable Foreign Keys
        await db.run(sql`PRAGMA foreign_keys = ON`);

        // Vacuum to reclaim space
        await db.run(sql`VACUUM`);

        console.log('[purgeDatabases] Main database truncated successfully.');

    } catch (error) {
        console.error('[purgeDatabases] FAILED to truncate main database:', error);
        throw error;
    }

    revalidatePath('/');
    return { success: true };
}

export async function purgeAvatars() {
    assertNonProduction();

    console.log('[purgeAvatars] Starting...');
    await stopAllActivities();

    const avatarDir = path.join(process.cwd(), 'public', 'avatars');
    try {
        // Build the path recursively manually or just use rm
        await fs.rm(avatarDir, { recursive: true, force: true });
        console.log('[purgeAvatars] Deleted public/avatars');
        await fs.mkdir(avatarDir, { recursive: true });
    } catch (error) {
        console.error('[purgeAvatars] Failed:', error);
        throw error;
    }

    return { success: true };
}

export async function purgeDownloads() {
    assertNonProduction();

    console.log('[purgeDownloads] Starting...');
    await stopAllActivities();

    const downloadDir = path.join(process.cwd(), 'public', 'downloads');
    try {
        await fs.rm(downloadDir, { recursive: true, force: true });
        console.log('[purgeDownloads] Deleted public/downloads');
        await fs.mkdir(downloadDir, { recursive: true });
    } catch (error) {
        console.error('[purgeDownloads] Failed:', error);
        throw error;
    }

    return { success: true };
}

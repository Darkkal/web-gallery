'use server';

import { db } from '@/lib/db';
import { sources, mediaItems, twitterUsers, twitterTweets, collectionItems, scrapeHistory } from '@/lib/db/schema';
import { ScraperRunner } from '@/lib/scrapers/runner';
import { scraperManager, ScrapingStatus } from '@/lib/scrapers/manager';
import { revalidatePath } from 'next/cache';
import path from 'path';
import { eq, desc, ne, inArray } from 'drizzle-orm';
import { syncLibrary } from '@/lib/library/scanner';
import fs from 'fs/promises';


const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');

export async function addSource(url: string) {
    // Simple heuristic to determine type
    let type: 'gallery-dl' | 'yt-dlp' = 'gallery-dl';
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('twitch.tv')) {
        type = 'yt-dlp';
    }

    await db.insert(sources).values({
        url,
        type,
        name: url, // Temporary name
    });

    revalidatePath('/sources');
}

export async function getSources() {
    return await db.select().from(sources);
}

export async function getSourcesWithHistory() {
    // Get all sources
    const allSources = await db.select().from(sources);

    // For each source, get the most recent scrape history
    const sourcesWithHistory = await Promise.all(
        allSources.map(async (source) => {
            const recentHistory = await db
                .select()
                .from(scrapeHistory)
                .where(eq(scrapeHistory.sourceId, source.id))
                .orderBy(desc(scrapeHistory.startTime))
                .limit(1);

            return {
                ...source,
                lastScrape: recentHistory[0] || null,
            };
        })
    );

    return sourcesWithHistory;
}

export async function scrapeSource(sourceId: number) {
    const source = await db.query.sources.findFirst({
        where: eq(sources.id, sourceId),
    });

    if (!source) {
        throw new Error('Source not found');
    }

    // Start in background via Manager
    await scraperManager.startScrape(sourceId, source.type as any, source.url, DOWNLOAD_DIR);

    revalidatePath('/sources');
    return { success: true, message: 'Scrape started in background' };
}

export async function getScrapingStatuses(): Promise<ScrapingStatus[]> {
    return scraperManager.getAllStatuses();
}

export async function stopScrapingSource(sourceId: number) {
    const success = scraperManager.stopScrape(sourceId);
    revalidatePath('/sources');
    return { success };
}

export async function deleteSource(id: number) {
    try {
        const numericId = Number(id);
        console.log(`[deleteSource] Attempting to delete source with ID: ${numericId} (original: ${id})`);

        if (isNaN(numericId)) {
            throw new Error(`Invalid source ID: ${id}`);
        }

        // Orphan linked media items first to avoid foreign key constraint error
        console.log(`[deleteSource] Nullifying sourceId for linked media items...`);
        const updateResult = db.update(mediaItems)
            .set({ sourceId: null })
            .where(eq(mediaItems.sourceId, numericId))
            .run();
        console.log(`[deleteSource] Media items update result:`, updateResult);

        console.log(`[deleteSource] Deleting source record...`);
        const deleteResult = db.delete(sources)
            .where(eq(sources.id, numericId))
            .run();
        console.log(`[deleteSource] Source deletion result:`, deleteResult);

        revalidatePath('/sources');
        console.log(`[deleteSource] Success.`);
        return { success: true };
    } catch (error) {
        console.error(`[deleteSource] FAILED:`, error);
        throw error;
    }
}

export async function scanLibrary() {
    await syncLibrary();
    revalidatePath('/gallery');
    revalidatePath('/');
}

export async function getMediaItems(
    filters?: {
        username?: string;
        minFavorites?: number;
        sortBy?: string;
    }
) {
    let conditions = ne(mediaItems.mediaType, 'text');

    const results = await db.select({
        item: mediaItems,
        tweet: twitterTweets,
        user: twitterUsers
    })
        .from(mediaItems)
        .leftJoin(twitterTweets, eq(mediaItems.id, twitterTweets.mediaItemId))
        .leftJoin(twitterUsers, eq(twitterTweets.userId, twitterUsers.id))
        .where(conditions);

    // Filter results
    let filtered = results.filter(row => {
        if (filters?.username) {
            // Check username, name, nick
            const search = filters.username.toLowerCase();
            const u = row.user;
            if (!u) return false;
            if (!u.name?.toLowerCase().includes(search) &&
                !u.nick?.toLowerCase().includes(search) &&
                !u.id.toLowerCase().includes(search)) {
                return false;
            }
        }
        if (filters?.minFavorites) {
            if ((row.tweet?.favoriteCount || 0) < filters.minFavorites) return false;
        }
        return true;
    });

    // Apply sorting
    const sortBy = filters?.sortBy || 'date-newest';

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date-oldest':
                const dateA = new Date(a.item.capturedAt || a.item.createdAt || 0).getTime();
                const dateB = new Date(b.item.capturedAt || b.item.createdAt || 0).getTime();
                return dateA - dateB; // Ascending: older (smaller) dates first

            case 'date-newest':
            default:
                const dateA2 = new Date(a.item.capturedAt || a.item.createdAt || 0).getTime();
                const dateB2 = new Date(b.item.capturedAt || b.item.createdAt || 0).getTime();
                return dateB2 - dateA2; // Descending: newer (larger) dates first

            case 'favorites-most':
                const favA = a.tweet?.favoriteCount || 0;
                const favB = b.tweet?.favoriteCount || 0;
                return favB - favA; // Descending: higher favorites first

            case 'favorites-least':
                const favA2 = a.tweet?.favoriteCount || 0;
                const favB2 = b.tweet?.favoriteCount || 0;
                return favA2 - favB2; // Ascending: lower favorites first

            case 'filename-asc':
                return a.item.filePath.localeCompare(b.item.filePath);

            case 'filename-desc':
                return b.item.filePath.localeCompare(a.item.filePath);
        }
    });

    return filtered;
}

export async function deleteMediaItems(ids: number[], deleteFiles: boolean) {
    try {
        console.log(`[deleteMediaItems] Deleting ${ids.length} items (deleteFiles: ${deleteFiles})`);

        if (ids.length === 0) return { success: true };

        // 1. Get file paths if we need to delete files
        if (deleteFiles) {
            const itemsToDelete = await db.select({ filePath: mediaItems.filePath })
                .from(mediaItems)
                .where(inArray(mediaItems.id, ids));

            for (const item of itemsToDelete) {
                try {
                    // filePath is likely relative to public, e.g., /downloads/...
                    const absolutePath = path.join(process.cwd(), 'public', item.filePath);
                    console.log(`[deleteMediaItems] Unlinking media: ${absolutePath}`);
                    await fs.unlink(absolutePath);

                    // Also try to delete associated .json metadata file
                    const ext = path.extname(item.filePath);
                    const jsonPathStr = item.filePath.substring(0, item.filePath.length - ext.length) + '.json';
                    const absoluteJsonPath = path.join(process.cwd(), 'public', jsonPathStr);

                    try {
                        await fs.access(absoluteJsonPath);
                        console.log(`[deleteMediaItems] Unlinking metadata: ${absoluteJsonPath}`);
                        await fs.unlink(absoluteJsonPath);
                    } catch {
                        // Metadata might not exist, ignore
                    }
                } catch (err: any) {
                    console.error(`[deleteMediaItems] Failed to delete file: ${item.filePath}`, err.message);
                }
            }
        }

        // 2. Delete related records
        console.log(`[deleteMediaItems] Deleting related tweets...`);
        db.delete(twitterTweets).where(inArray(twitterTweets.mediaItemId, ids)).run();

        console.log(`[deleteMediaItems] Deleting collection associations...`);
        db.delete(collectionItems).where(inArray(collectionItems.mediaItemId, ids)).run();

        // 3. Delete media items
        console.log(`[deleteMediaItems] Deleting media records...`);
        const result = db.delete(mediaItems).where(inArray(mediaItems.id, ids)).run();
        console.log(`[deleteMediaItems] DB Result:`, result);

        revalidatePath('/gallery');
        revalidatePath('/timeline');
        revalidatePath('/');

        return { success: true, count: result.changes };
    } catch (error) {
        console.error(`[deleteMediaItems] FAILED:`, error);
        throw error;
    }
}

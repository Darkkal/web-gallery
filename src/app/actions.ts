'use server';

import { db } from '@/lib/db';
import { scanHistory, tags, posts, postTags } from '@/lib/db/schema';
import { scraperManager, ScrapingStatus } from '@/lib/scrapers/manager';
import { revalidatePath } from 'next/cache';
import path from 'path';
import { desc, count, sql, eq } from 'drizzle-orm';

import { syncLibrary, stopScanning } from '@/lib/library/scanner';

import * as mediaRepo from '@/lib/db/repositories/media';
import * as postsRepo from '@/lib/db/repositories/posts';
import * as sourcesRepo from '@/lib/db/repositories/sources';

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');

export async function getPostTags(postId: number) {
    return postsRepo.getPostTags(postId);
}

export async function addSource(url: string, name?: string) {
    await sourcesRepo.addSource(url, name);
    revalidatePath('/sources');
}

export async function updateSource(id: number, updates: { url?: string; name?: string }) {
    await sourcesRepo.updateSource(id, updates);
    revalidatePath('/sources');
}

export async function getSources() {
    return sourcesRepo.getSources();
}

export async function getSourcesWithHistory() {
    return sourcesRepo.getSourcesWithHistory();
}

export async function scrapeSource(sourceId: number, mode: 'full' | 'quick' = 'full') {
    const source = await sourcesRepo.getSourceById(sourceId);

    if (!source) {
        throw new Error('Source not found');
    }

    await scraperManager.startScrape(sourceId, 'gallery-dl', source.url, DOWNLOAD_DIR, { mode });

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
    await sourcesRepo.deleteSource(id);
    revalidatePath('/sources');
    return { success: true };
}

export async function scanLibrary() {
    syncLibrary().catch(console.error);
    return { started: true };
}

export async function stopLibraryScan() {
    stopScanning();
    return { requested: true };
}

export async function getScanHistory() {
    return await db.select().from(scanHistory).orderBy(desc(scanHistory.startTime));
}

export async function getLatestScan() {
    const scans = await db.select().from(scanHistory).orderBy(desc(scanHistory.startTime)).limit(1);
    return scans[0] || null;
}

export async function getMediaItems(filters?: { search?: string; sortBy?: string; }) {
    return mediaRepo.getMediaItems(filters);
}

export type { TimelinePost } from '@/lib/db/repositories/posts';

export async function getTimelinePosts(page = 1, limit = 20, search = '') {
    return postsRepo.getTimelinePosts(page, limit, search);
}

export async function deleteMediaItems(ids: number[], deleteFiles: boolean) {
    const result = await mediaRepo.deleteMediaItems(ids, deleteFiles);
    revalidatePath('/gallery');
    revalidatePath('/timeline');
    revalidatePath('/');
    return result;
}

export async function getTopTags(sort: 'count' | 'new' | 'recent' = 'count') {
    if (sort === 'new') {
        const results = await db.select({
            name: tags.name,
            id: tags.id
        })
            .from(tags)
            .orderBy(desc(tags.id))
            .limit(100);
        return results.map(r => ({ name: r.name, count: 0 }));
    }

    if (sort === 'recent') {
        const results = await db.select({
            name: tags.name,
            lastDate: sql<string>`MAX(${posts.date})`,
            count: count(postTags.tagId)
        })
            .from(tags)
            .innerJoin(postTags, eq(tags.id, postTags.tagId))
            .innerJoin(posts, eq(postTags.postId, posts.id))
            .groupBy(tags.id)
            .orderBy(desc(sql`MAX(${posts.date})`))
            .limit(100);

        return results;
    }

    const results = await db.select({
        name: tags.name,
        count: count(postTags.tagId)
    })
        .from(tags)
        .innerJoin(postTags, eq(tags.id, postTags.tagId))
        .groupBy(tags.id)
        .orderBy(desc(count(postTags.tagId)))
        .limit(100);

    return results;
}

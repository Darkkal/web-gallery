'use server';

import { db } from '@/lib/db';
import { sources, mediaItems } from '@/lib/db/schema';
import { ScraperRunner } from '@/lib/scrapers/runner';
import { revalidatePath } from 'next/cache';
import path from 'path';
import { eq, desc, ne } from 'drizzle-orm';
import { syncLibrary } from '@/lib/library/scanner';


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

export async function scrapeSource(sourceId: number) {
    const source = await db.query.sources.findFirst({
        where: eq(sources.id, sourceId),
    });

    if (!source) {
        throw new Error('Source not found');
    }

    const runner = new ScraperRunner(DOWNLOAD_DIR);
    const result = await runner.run(source.type as any, {
        url: source.url,
    });

    if (result.success) {
        // Update last scraped time
        await db.update(sources)
            .set({ lastScrapedAt: new Date() })
            .where(eq(sources.id, sourceId));

        // TODO: Parse result.items and insert into mediaItems
        // For now, we trust the files are on disk. 
        // real implementation would parse the output or scan the directory.
    }

    revalidatePath('/sources');
    return result;
}

export async function deleteSource(id: number) {
    await db.delete(sources).where(eq(sources.id, id));
    revalidatePath('/sources');
}

export async function scanLibrary() {
    await syncLibrary();
    revalidatePath('/gallery');
    revalidatePath('/');
}

export async function getMediaItems() {
    return await db.query.mediaItems.findMany({
        where: ne(mediaItems.mediaType, 'text'),
        orderBy: [desc(mediaItems.capturedAt), desc(mediaItems.createdAt)],
    });
}

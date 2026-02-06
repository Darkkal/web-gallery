'use server';

import { db } from '@/lib/db';
import { scrapingTasks, scrapeHistory, sources } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { scraperManager, ScrapingStatus } from '@/lib/scrapers/manager';
import { revalidatePath } from 'next/cache';
import { isNull, and } from 'drizzle-orm';

export async function getActiveScrapeStatuses(): Promise<ScrapingStatus[]> {
    return scraperManager.getAllStatuses();
}

export async function getScrapeTasks() {
    return await db.query.scrapingTasks.findMany({
        where: (tasks, { exists }) => exists(
            db.select().from(sources).where(and(eq(sources.id, tasks.sourceId), isNull(sources.deletedAt)))
        ),
        orderBy: desc(scrapingTasks.createdAt),
    });
}

export async function getScrapeTask(id: number) {
    return await db.query.scrapingTasks.findFirst({
        where: eq(scrapingTasks.id, id),
    });
}

export async function createScrapeTask(data: {
    sourceId: number;
    name?: string;
    downloadOptions?: { stopAfterCompleted?: number; stopAfterSkipped?: number; stopAfterPosts?: number };
    scheduleInterval?: number;
    enabled?: boolean;
}) {
    await db.insert(scrapingTasks).values({
        sourceId: data.sourceId,
        name: data.name,
        downloadOptions: data.downloadOptions,
        scheduleInterval: data.scheduleInterval,
        enabled: data.enabled ?? true,
    });
    revalidatePath('/scrape');
}

export async function updateScrapeTask(id: number, data: {
    name?: string;
    downloadOptions?: { stopAfterCompleted?: number; stopAfterSkipped?: number; stopAfterPosts?: number };
    scheduleInterval?: number;
    enabled?: boolean;
}) {
    await db.update(scrapingTasks)
        .set(data)
        .where(eq(scrapingTasks.id, id));
    revalidatePath('/scrape');
}

export async function deleteScrapeTask(id: number) {
    await db.delete(scrapingTasks).where(eq(scrapingTasks.id, id));
    revalidatePath('/scrape');
}

export async function toggleTaskSchedule(id: number, enabled: boolean) {
    await db.update(scrapingTasks)
        .set({ enabled })
        .where(eq(scrapingTasks.id, id));
    revalidatePath('/scrape');
}

export async function runTaskNow(taskId: number) {
    const task = await db.query.scrapingTasks.findFirst({
        where: eq(scrapingTasks.id, taskId),
    });

    if (!task) {
        throw new Error('Task not found');
    }

    const source = await db.query.sources.findFirst({
        where: eq(sources.id, task.sourceId),
    });

    if (!source) {
        throw new Error('Source not found');
    }

    // Determine type (gallery-dl or yt-dlp) based on source URL or extractor type
    // This logic mimics what is likely in the main actions file or we can infer it
    // For now defaulting to gallery-dl unless yt-dlp specific domains logic exists
    // But wait, the source usually has extractorType.
    // If not, we might need to guess.
    // Assuming gallery-dl for now as it handles most.
    const tool = 'gallery-dl';

    await scraperManager.startScrape(
        task.sourceId,
        tool,
        source.url,
        'public/downloads', // Default path, should be configurable?
        {
            mode: 'full', // Default mode
            taskId: task.id,
            limits: task.downloadOptions || undefined
        }
    );

    // Update last run time
    await db.update(scrapingTasks)
        .set({ lastRunAt: new Date() })
        .where(eq(scrapingTasks.id, taskId));

    revalidatePath('/scrape');
}

export async function stopTask(taskId: number) {
    const task = await db.query.scrapingTasks.findFirst({
        where: eq(scrapingTasks.id, taskId),
    });

    if (task) {
        scraperManager.stopScrape(task.sourceId);
        revalidatePath('/scrape');
    }
}

export async function getScrapeHistory(limit = 50) {
    return await db.query.scrapeHistory.findMany({
        orderBy: desc(scrapeHistory.startTime),
        limit: limit,
        with: {
            // potentially join task or source
        }
    });
}

// Helper to get all sources for the dropdown
export async function getSources() {
    return await db.query.sources.findMany({
        where: isNull(sources.deletedAt),
        orderBy: desc(sources.createdAt),
    });
}

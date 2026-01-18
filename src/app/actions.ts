'use server';

import { db } from '@/lib/db';
import { sources, mediaItems, twitterUsers, twitterTweets, collectionItems, scrapeHistory, pixivUsers, pixivIllusts, tags, pixivIllustTags, scanHistory, gallerydlExtractorTypes } from '@/lib/db/schema';
import { ScraperRunner } from '@/lib/scrapers/runner';
import { scraperManager, ScrapingStatus } from '@/lib/scrapers/manager';
import { revalidatePath } from 'next/cache';
import path from 'path';
import { eq, desc, ne, inArray, isNull, and, asc, like, or } from 'drizzle-orm';
import { syncLibrary, stopScanning } from '@/lib/library/scanner';
import fs from 'fs/promises';



const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');

export async function getPixivTags(illustId: number) {
    const illustTags = await db.select({
        name: tags.name,
        // type: tags.type // Optional
    })
        .from(pixivIllustTags)
        .innerJoin(tags, eq(pixivIllustTags.tagId, tags.id))
        .where(eq(pixivIllustTags.illustId, illustId));

    return illustTags;
}

export async function addSource(url: string) {
    // Simple heuristic to determine type
    let type: 'twitter' | 'pixiv' | 'gallery-dl' = 'gallery-dl';
    if (url.includes('twitter.com') || url.includes('x.com')) type = 'twitter';
    if (url.includes('pixiv.net')) type = 'pixiv';

    // Ensure Extractor Type Exists
    await db.insert(gallerydlExtractorTypes).values({ id: type }).onConflictDoNothing().run();

    await db.insert(sources).values({
        url,
        extractorType: type, // New column
        name: url, // Temporary name
    });

    revalidatePath('/sources');
}

export async function getSources() {
    return await db.select().from(sources).where(isNull(sources.deletedAt));
}

export async function getSourcesWithHistory() {
    // Get all sources
    const allSources = await db.select().from(sources).where(isNull(sources.deletedAt));

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

export async function scrapeSource(sourceId: number, mode: 'full' | 'quick' = 'full') {
    const source = await db.query.sources.findFirst({
        where: and(eq(sources.id, sourceId), isNull(sources.deletedAt)),
    });

    if (!source) {
        throw new Error('Source not found');
    }

    // Start in background via Manager
    // Pass 'gallery-dl' or 'yt-dlp' based on logic?
    // We removed 'type' from source, now we have 'extractorType'. 
    // Assuming all are gallery-dl for now unless we add yt-dlp specific field.
    // But 'extractorType' is 'twitter'/'pixiv'. Tool is gallery-dl.
    await scraperManager.startScrape(sourceId, 'gallery-dl' as any, source.url, DOWNLOAD_DIR, { mode });

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
        if (isNaN(numericId)) {
            throw new Error(`Invalid source ID: ${id}`);
        }

        // Soft delete the source
        await db.update(sources)
            .set({ deletedAt: new Date() })
            .where(eq(sources.id, numericId))
            .run();

        revalidatePath('/sources');
        return { success: true };
    } catch (error) {
        console.error(`[deleteSource] FAILED:`, error);
        throw error;
    }
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

export async function getMediaItems(
    filters?: {
        search?: string;
        sortBy?: string;
    }
) {
    // 1. Parse Search Query
    let searchQuery = filters?.search || '';
    let minFavorites = 0;

    // Extract "favs:123" or "min_favs:123"
    const favsMatch = searchQuery.match(/(?:favs|min_favs):(\d+)/i);
    if (favsMatch) {
        minFavorites = parseInt(favsMatch[1], 10);
        // Remove the command from the search string so we don't try to match "favs:10" as text
        searchQuery = searchQuery.replace(favsMatch[0], '').trim();
    }

    let conditions = ne(mediaItems.mediaType, 'text');

    // Updated Joins for New Polymorphic Schema
    const results = await db.select({
        item: mediaItems,
        tweet: twitterTweets,
        user: twitterUsers,
        pixiv: pixivIllusts,
        pixivUser: pixivUsers,
        source: sources,
    })
        .from(mediaItems)
        // Join Posts via Polymorphic Logic
        .leftJoin(twitterTweets, and(
            eq(mediaItems.internalPostId, twitterTweets.id),
            eq(mediaItems.extractorType, 'twitter')
        ))
        .leftJoin(twitterUsers, eq(twitterTweets.userId, twitterUsers.id))

        .leftJoin(pixivIllusts, and(
            eq(mediaItems.internalPostId, pixivIllusts.id),
            eq(mediaItems.extractorType, 'pixiv')
        ))
        .leftJoin(pixivUsers, eq(pixivIllusts.userId, pixivUsers.id))

        // Join Internal Source derived from posts (if available) or direct link if any (none on mediaItems anymore)
        // We can join sources via internalSourceId on the posts
        .leftJoin(sources, or(
            eq(twitterTweets.internalSourceId, sources.id),
            eq(pixivIllusts.internalSourceId, sources.id)
        ))
        .where(conditions);

    const searchLower = searchQuery.toLowerCase();

    // Filter results
    let filtered = results.filter(row => {
        // 1. Min Favorites Filter
        if (minFavorites > 0) {
            if (row.tweet) {
                if ((row.tweet.favoriteCount || 0) < minFavorites) return false;
            }
            if (row.pixiv) {
                if ((row.pixiv.totalBookmarks || 0) < minFavorites) return false;
            }
        }

        // 2. Text Search
        if (searchLower) {
            let hit = false;

            // Check Twitter User
            if (row.user) {
                if (row.user.name?.toLowerCase().includes(searchLower)) hit = true;
                else if (row.user.nick?.toLowerCase().includes(searchLower)) hit = true;
                else if (row.user.id.toLowerCase().includes(searchLower)) hit = true;
            }

            // Check Pixiv User
            if (!hit && row.pixivUser) {
                if (row.pixivUser.name?.toLowerCase().includes(searchLower)) hit = true;
                else if (row.pixivUser.account?.toLowerCase().includes(searchLower)) hit = true;
                else if (row.pixivUser.id.toLowerCase().includes(searchLower)) hit = true;
            }

            // Check Tweet Content
            if (!hit && row.tweet) {
                if (row.tweet.content?.toLowerCase().includes(searchLower)) hit = true;
            }

            // Check Pixiv Title/Caption
            if (!hit && row.pixiv) {
                if (row.pixiv.title?.toLowerCase().includes(searchLower)) hit = true;
                if (row.pixiv.caption?.toLowerCase().includes(searchLower)) hit = true;

                // Check Pixiv Tags (JSON string)
                if (Array.isArray(row.pixiv.tags)) {
                    if (JSON.stringify(row.pixiv.tags).toLowerCase().includes(searchLower)) hit = true;
                }
            }

            // Check Source Name/Type
            if (!hit && row.source) {
                if (row.source.name?.toLowerCase().includes(searchLower)) hit = true;
                // if (row.source.type?.toLowerCase().includes(searchLower)) hit = true; // 'type' removed
            }

            if (!hit) return false;
        }

        return true;
    });

    // Apply sorting
    const sortBy = filters?.sortBy || 'created-desc';

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'created-asc': // Oldest Imported First
                const cDateA = new Date(a.item.createdAt || 0).getTime();
                const cDateB = new Date(b.item.createdAt || 0).getTime();
                return cDateA - cDateB;

            case 'created-desc': // Newest Imported First
            default:
                const cDateA2 = new Date(a.item.createdAt || 0).getTime();
                const cDateB2 = new Date(b.item.createdAt || 0).getTime();
                return cDateB2 - cDateA2;

            case 'captured-asc': // Oldest Content First
                const capDateA = new Date(a.item.capturedAt || a.item.createdAt || 0).getTime();
                const capDateB = new Date(b.item.capturedAt || b.item.createdAt || 0).getTime();
                return capDateA - capDateB;

            case 'captured-desc': // Newest Content First
                const capDateA2 = new Date(a.item.capturedAt || a.item.createdAt || 0).getTime();
                const capDateB2 = new Date(b.item.capturedAt || b.item.createdAt || 0).getTime();
                return capDateB2 - capDateA2;
        }
    });

    return filtered;
}

export type TimelinePost = {
    id: string; // Unique ID for the post group
    type: 'twitter' | 'pixiv' | 'other';
    date: Date;
    author?: {
        name?: string;
        handle?: string; // nick or account
        avatar?: string;
        url?: string;
    };
    content?: string;
    mediaItems: {
        id: number;
        url: string; // filePath
        type: 'image' | 'video' | 'audio' | 'text';
        width?: number; // for pixiv mainly
        height?: number;
    }[];
    stats?: {
        likes?: number; // favorite_count / total_bookmarks
        views?: number;
        bookmarks?: number; // bookmark_count
        retweets?: number;
    };
    sourceUrl?: string; // Original Post URL
    pixivMetadata?: {
        dbId: number;
        illustId: number;
    };
};

export async function getTimelinePosts(page = 1, limit = 20): Promise<TimelinePost[]> {
    const items = await db.select({
        item: mediaItems,
        tweet: twitterTweets,
        twitterUser: twitterUsers,
        illust: pixivIllusts,
        pixivUser: pixivUsers,
        source: sources,
    })
        .from(mediaItems)
        // Join new FKs
        .leftJoin(twitterTweets, and(
            eq(mediaItems.internalPostId, twitterTweets.id),
            eq(mediaItems.extractorType, 'twitter')
        ))
        .leftJoin(twitterUsers, eq(twitterTweets.userId, twitterUsers.id))
        .leftJoin(pixivIllusts, and(
            eq(mediaItems.internalPostId, pixivIllusts.id),
            eq(mediaItems.extractorType, 'pixiv')
        ))
        .leftJoin(pixivUsers, eq(pixivIllusts.userId, pixivUsers.id))
        .leftJoin(sources, or(
            eq(twitterTweets.internalSourceId, sources.id),
            eq(pixivIllusts.internalSourceId, sources.id)
        ))
        .orderBy(desc(mediaItems.capturedAt));

    // 2. Group items
    const postsMap = new Map<string, TimelinePost>();
    const processingOrder: string[] = []; // To maintain sort order

    for (const row of items) {
        let groupId: string;
        let type: 'twitter' | 'pixiv' | 'other' = 'other';
        let author: TimelinePost['author'] = undefined;
        let content: string | undefined = undefined;
        let stats: TimelinePost['stats'] = undefined;
        let sourceUrl: string | undefined = undefined;
        let pixivMetadata: TimelinePost['pixivMetadata'] = undefined;

        // Determine Group ID and Metadata
        if (row.tweet) {
            groupId = `twitter-${row.tweet.tweetId}`;
            type = 'twitter';
            author = {
                name: row.twitterUser?.name || undefined,
                handle: row.twitterUser?.nick || undefined,
                avatar: row.twitterUser?.profileImage || undefined,
                url: row.twitterUser ? `https://twitter.com/${row.twitterUser.nick}` : undefined
            };
            content = row.tweet.content || undefined;
            stats = {
                likes: row.tweet.favoriteCount || 0,
                views: row.tweet.viewCount || 0,
                bookmarks: row.tweet.bookmarkCount || 0,
                retweets: row.tweet.retweetCount || 0
            };
            sourceUrl = `https://twitter.com/${row.tweet.userId}/status/${row.tweet.tweetId}`; // Approximate
        } else if (row.illust) {
            groupId = `pixiv-${row.illust.pixivId}`;
            type = 'pixiv';
            author = {
                name: row.pixivUser?.name || undefined,
                handle: row.pixivUser?.account || undefined,
                avatar: row.pixivUser?.profileImage || undefined,
                url: row.pixivUser ? `https://www.pixiv.net/users/${row.pixivUser.id}` : undefined
            };
            content = row.illust.caption || row.illust.title || undefined;
            stats = {
                likes: row.illust.totalBookmarks || 0, // Pixiv bookmarks is mostly like 'likes'
                views: row.illust.totalView || 0,
            };
            sourceUrl = `https://www.pixiv.net/artworks/${row.illust.pixivId}`;
            pixivMetadata = {
                dbId: row.illust.id,
                illustId: row.illust.pixivId
            };
        } else {
            groupId = `item-${row.item.id}`; // Standalone
            type = 'other';
            // content = row.item.description // removed
            sourceUrl = row.item.filePath; // fallback
        }

        // Init Post if needed
        if (!postsMap.has(groupId)) {
            // Use the date of the first item encountered (which is latest due to sort)
            const date = row.item.capturedAt || row.item.createdAt || new Date();

            postsMap.set(groupId, {
                id: groupId,
                type,
                date,
                author,
                content,
                mediaItems: [],
                stats,
                sourceUrl,
                pixivMetadata
            });
            processingOrder.push(groupId);
        }

        const post = postsMap.get(groupId)!;

        // Add Media Item (include text items so they can be selected in lightbox)
        post.mediaItems.push({
            id: row.item.id,
            url: row.item.filePath,
            type: row.item.mediaType as 'image' | 'video' | 'audio' | 'text',
            width: row.illust?.width || undefined,
            height: row.illust?.height || undefined // Only Pixiv has reliable dimensions in DB currently
        });
    }

    // Pagination (In Memory)
    // Convert map to array in order
    const allPosts = processingOrder.map(id => {
        const post = postsMap.get(id)!;
        // Sort media items by URL (filename) to ensure p0, p1, p2 order
        post.mediaItems.sort((a, b) => a.url.localeCompare(b.url));
        return post;
    });

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit;

    return allPosts.slice(start, end);
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
        // DO NOT delete twitterTweets or pixivIllusts! Only media items.
        // User wants to keep the post metadata theoretically, unless it's a full cleanup.
        // But the previous implementation deleted tweets. 
        // With new schema, mediaItems is CHILD. Deleting child is safe.
        // If we want to clean up orphaned tweets, that's a separate task (GC).

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

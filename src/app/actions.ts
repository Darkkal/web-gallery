'use server';

import { db } from '@/lib/db';
import { sources, mediaItems, twitterUsers, twitterTweets, collectionItems, scrapeHistory, pixivUsers, pixivIllusts, tags, pixivIllustTags } from '@/lib/db/schema';
import { ScraperRunner } from '@/lib/scrapers/runner';
import { scraperManager, ScrapingStatus } from '@/lib/scrapers/manager';
import { revalidatePath } from 'next/cache';
import path from 'path';
import { eq, desc, ne, inArray } from 'drizzle-orm';
import { syncLibrary } from '@/lib/library/scanner';
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

    const results = await db.select({
        item: mediaItems,
        tweet: twitterTweets,
        user: twitterUsers,
        pixiv: pixivIllusts,
        pixivUser: pixivUsers,
        source: sources,
    })
        .from(mediaItems)
        .leftJoin(twitterTweets, eq(mediaItems.id, twitterTweets.mediaItemId))
        .leftJoin(twitterUsers, eq(twitterTweets.userId, twitterUsers.id))
        .leftJoin(pixivIllusts, eq(mediaItems.id, pixivIllusts.mediaItemId))
        .leftJoin(pixivUsers, eq(pixivIllusts.userId, pixivUsers.id))
        .leftJoin(sources, eq(mediaItems.sourceId, sources.id)) // Join sources for text search
        .where(conditions);

    // Fetch tags for filtering if needed. 
    // Doing a separate query or join for tags can be heavy if we join everything.
    // However, to filter by tag name efficiently in valid SQL, we would usually need a join.
    // For now, let's fetch all necessary data and filter in memory since our dataset is not massive yet,
    // OR separate tag fetching. 
    // Given the architecture, let's fetch tags locally for the candidates if strict SQL search is hard without 1-to-many explosion.
    // Actually, let's just do in-memory filtering for the complex text search to keep it flexible as requested.

    // Optimization: If search query is empty, our current join is fine.

    // We need to fetch tags for each item to search them? 
    // Actually, `pixivIllusts` has a `tags` JSON field! We can just search that! 
    // `twitterTweets.content` is also available.

    const searchLower = searchQuery.toLowerCase();

    // Filter results
    let filtered = results.filter(row => {
        // 1. Min Favorites Filter
        if (minFavorites > 0) {
            if ((row.tweet?.favoriteCount || 0) < minFavorites) return false;
            // Pixiv bookmarks count could be used here too if we want unified "favorites"
            // if ((row.pixiv?.totalBookmarks || 0) < minFavorites) ... 
            // For now, sticking to the existing behavior which seemed to imply Tweet favorites.
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
                // The schema says `tags` is `text` with mode `json`. Drizzle might parse it automatically if configured, 
                // but our schema definition `tags: text('tags', { mode: 'json' })` suggests it comes back as an array.
                // Let's check safely.
                if (Array.isArray(row.pixiv.tags)) {
                    // tags is array of strings or objects? Usually Pixiv tags are objects or strings.
                    // Let's assume generic string search in the JSON representation if unsure, 
                    // or iterate if it's an array of strings.
                    // Printing to debug might be needed, but assuming standard "includes" on stringified ver guarantees hit.
                    if (JSON.stringify(row.pixiv.tags).toLowerCase().includes(searchLower)) hit = true;
                }
            }

            // Check Source Name/Type
            if (!hit && row.source) {
                if (row.source.name?.toLowerCase().includes(searchLower)) hit = true;
                if (row.source.type?.toLowerCase().includes(searchLower)) hit = true;
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
    // 1. Fetch all items (including text)
    // We fetch a larger batch because grouping reduces the count
    // This is a naive pagination for now (fetching limit * X items and grouping)
    // A proper SQL group-by pagination is complex with this schema.
    // For now, let's fetch 'limit' * 5 items to try and fill 'limit' posts.

    // Note: To implement proper pagination, we might need to fetch distinct tweetIds/pixivIds first.
    // But we also have mixed content (non-grouped items).
    // Let's stick to fetching detailed items and grouping in memory for this scale.

    // TODO: Optimize pagination. Currently fetching all and slicing might be too heavy eventually.
    // But user has requested "Timeline", usually implies recent first.

    const items = await db.select({
        item: mediaItems,
        tweet: twitterTweets,
        twitterUser: twitterUsers,
        illust: pixivIllusts,
        pixivUser: pixivUsers,
        source: sources,
    })
        .from(mediaItems)
        .leftJoin(twitterTweets, eq(mediaItems.id, twitterTweets.mediaItemId))
        .leftJoin(twitterUsers, eq(twitterTweets.userId, twitterUsers.id))
        .leftJoin(pixivIllusts, eq(mediaItems.id, pixivIllusts.mediaItemId))
        .leftJoin(pixivUsers, eq(pixivIllusts.userId, pixivUsers.id))
        .leftJoin(sources, eq(mediaItems.sourceId, sources.id))
        .orderBy(desc(mediaItems.capturedAt));
    // We sort by capturedAt (content date) to order the timeline chronologically.

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
            content = row.item.description || row.item.title || undefined;
            sourceUrl = row.item.originalUrl || undefined;
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
    const allPosts = processingOrder.map(id => postsMap.get(id)!);

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

'use server';

import { db } from '@/lib/db';
import { sources, mediaItems, twitterUsers, collectionItems, scrapeHistory, pixivUsers, tags, scanHistory, gallerydlExtractorTypes, posts, postDetailsTwitter, postDetailsPixiv, postDetailsGelbooruV02, postTags } from '@/lib/db/schema';
import { scraperManager, ScrapingStatus } from '@/lib/scrapers/manager';
import { revalidatePath } from 'next/cache';
import path from 'path';
import { eq, desc, ne, inArray, isNull, and, like, count, sql, SQL } from 'drizzle-orm';

import { syncLibrary, stopScanning } from '@/lib/library/scanner';
import fs from 'fs/promises';



const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');

export async function getPostTags(postId: number) {
    // postId is now the generic posts.id
    const pTags = await db.select({
        name: tags.name,
        id: tags.id
    })
        .from(postTags)
        .innerJoin(tags, eq(postTags.tagId, tags.id))
        .where(eq(postTags.postId, postId));

    return pTags;
}

export async function addSource(url: string, name?: string) {
    // Check if it's a local path
    let isLocal = false;
    try {
        // Simple check for absolute path (starts with / or C:\ etc) or existing directory
        // We use fs.stat to check if it exists and is a directory
        const stat = await fs.stat(url);
        if (stat.isDirectory()) {
            isLocal = true;
        }
    } catch {
        // Not a local path or doesn't exist
    }

    let type: 'twitter' | 'pixiv' | 'gallery-dl' | 'local' | 'gelbooruv02' = 'gallery-dl';

    if (isLocal) {
        type = 'local';
    } else {
        if (url.includes('twitter.com') || url.includes('x.com')) type = 'twitter';
        if (url.includes('pixiv.net')) type = 'pixiv';
        if (url.includes('gelbooru.com') || url.includes('safebooru.org')) type = 'gelbooruv02';
    }

    // Ensure Extractor Type Exists
    await db.insert(gallerydlExtractorTypes).values({ id: type }).onConflictDoNothing().run();

    await db.insert(sources).values({
        url,
        extractorType: type,
        name: name || (isLocal ? path.basename(url) : url), // Use provided name or fallback
    });

    revalidatePath('/sources');
}

export async function updateSource(id: number, updates: { url?: string; name?: string }) {
    if (!updates.url && !updates.name) return;

    await db.update(sources)
        .set({
            ...(updates.url ? { url: updates.url } : {}),
            ...(updates.name ? { name: updates.name } : {}),
        })
        .where(eq(sources.id, id))
        .run();

    revalidatePath('/sources');
}

export async function getSources() {
    return await db.select().from(sources).where(isNull(sources.deletedAt));
}

export async function getSourcesWithHistory() {
    // Get all sources
    const allSources = await db.select().from(sources).where(isNull(sources.deletedAt));

    // For each source, get the most recent scrape history AND a preview image
    const sourcesWithData = await Promise.all(
        allSources.map(async (source) => {
            // 1. History
            const recentHistory = await db
                .select()
                .from(scrapeHistory)
                .where(eq(scrapeHistory.sourceId, source.id))
                .orderBy(desc(scrapeHistory.startTime))
                .limit(1);

            // 2. Preview Image (Latest Post -> First Image)
            let previewImage: string | null = null;
            const recentPost = await db.select({ id: posts.id })
                .from(posts)
                .where(eq(posts.internalSourceId, source.id))
                .orderBy(desc(posts.createdAt)) // or posts.date
                .limit(1);

            if (recentPost.length > 0) {
                const media = await db.select({ filePath: mediaItems.filePath })
                    .from(mediaItems)
                    .where(and(
                        eq(mediaItems.postId, recentPost[0].id),
                        eq(mediaItems.mediaType, 'image')
                    ))
                    .limit(1);

                if (media.length > 0) {
                    previewImage = media[0].filePath;
                }
            }

            return {
                ...source,
                lastScrape: recentHistory[0] || null,
                previewImage,
            };
        })
    );

    return sourcesWithData;
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
        searchQuery = searchQuery.replace(favsMatch[0], '').trim();
    }

    // Extract "source:type"
    let sourceFilter: string | null = null;
    const sourceMatch = searchQuery.match(/source:([a-zA-Z0-9_-]+)/i);
    if (sourceMatch) {
        sourceFilter = sourceMatch[1].toLowerCase();
        searchQuery = searchQuery.replace(sourceMatch[0], '').trim();
    }

    let conditions: SQL | undefined = ne(mediaItems.mediaType, 'text');

    if (sourceFilter) {
        // Filter by posts.extractorType via join
        conditions = and(conditions, eq(posts.extractorType, sourceFilter));
    }

    // 2. Pre-fetch Tag Matches if optimized search
    let tagMatchedPostIds: Set<number> | null = null;
    if (searchQuery.length > 1) {
        const searchLower = searchQuery.toLowerCase();
        const matchedTags = await db.selectDistinct({
            postId: postTags.postId
        })
            .from(tags)
            .innerJoin(postTags, eq(tags.id, postTags.tagId))
            .where(like(tags.name, `%${searchLower}%`));

        if (matchedTags.length > 0) {
            tagMatchedPostIds = new Set(matchedTags.map(m => m.postId));
        }
    }

    // Updated Joins for New Generic Posts Schema
    const results = await db.select({
        item: mediaItems,
        post: posts,
        twitter: postDetailsTwitter,
        pixiv: postDetailsPixiv,
        gelbooru: postDetailsGelbooruV02,
        user: twitterUsers,
        pixivUser: pixivUsers,
        source: sources,
    })
        .from(mediaItems)
        // Join Posts
        .leftJoin(posts, eq(mediaItems.postId, posts.id))

        // Join Details
        .leftJoin(postDetailsTwitter, eq(posts.id, postDetailsTwitter.postId))
        .leftJoin(postDetailsPixiv, eq(posts.id, postDetailsPixiv.postId))
        .leftJoin(postDetailsGelbooruV02, eq(posts.id, postDetailsGelbooruV02.postId))

        // Join Users
        .leftJoin(twitterUsers, and(
            eq(posts.extractorType, 'twitter'),
            eq(posts.userId, twitterUsers.id)
        ))
        .leftJoin(pixivUsers, and(
            eq(posts.extractorType, 'pixiv'),
            eq(posts.userId, pixivUsers.id)
        ))

        // Join Sources
        .leftJoin(sources, eq(posts.internalSourceId, sources.id))

        .where(conditions);

    // Transform Avatar URLs
    results.forEach(row => {
        if (row.user && row.user.id) {
            row.user.profileImage = `/api/avatar/twitter/${row.user.id}`;
        }
        if (row.pixivUser && row.pixivUser.id) {
            row.pixivUser.profileImage = `/api/avatar/pixiv/${row.pixivUser.id}`;
        }
    });

    // 3. Group by Post Logic
    // We want to return a list where each element represents a Post (or isolated Media Item)
    // and contains a list of all media items belonging to it.

    // Type definition for the grouped result (inferred)
    type GroupedResult = typeof results[number] & {
        groupItems: typeof results[number][]; // All sibling rows
        groupCount: number;
    };

    const groupedMap = new Map<string, GroupedResult>();

    for (const row of results) {
        // Key: Post ID if available, otherwise Item ID (unique for orphans)
        const key = row.post ? `p_${row.post.id}` : `i_${row.item.id}`;

        if (!groupedMap.has(key)) {
            groupedMap.set(key, {
                ...row, // Inherit properties of the first item (primary)
                groupItems: [],
                groupCount: 0
            });
        }

        const group = groupedMap.get(key)!;
        group.groupItems.push(row);
        group.groupCount++;
    }

    const groupedResults = Array.from(groupedMap.values());
    const searchLower = searchQuery.toLowerCase();

    // 4. Filter Groups
    const filtered = groupedResults.filter(row => {
        // 1. Min Favorites Filter
        if (minFavorites > 0) {
            if (row.twitter) {
                if ((row.twitter.favoriteCount || 0) < minFavorites) return false;
            }
            if (row.pixiv) {
                if ((row.pixiv.totalBookmarks || 0) < minFavorites) return false;
            }
            if (row.gelbooru) {
                if ((row.gelbooru.score || 0) < minFavorites) return false;
            }
        }

        // 2. Text Search
        if (searchLower) {
            let hit = false;

            // Check Post
            if (row.post) {
                if (row.post.title?.toLowerCase().includes(searchLower)) hit = true;
                if (row.post.content?.toLowerCase().includes(searchLower)) hit = true;
            }

            // Check Users
            if (!hit) {
                if (row.user) {
                    if (row.user.name?.toLowerCase().includes(searchLower)) hit = true;
                    if (row.user.nick?.toLowerCase().includes(searchLower)) hit = true;
                }
                if (row.pixivUser) {
                    if (row.pixivUser.name?.toLowerCase().includes(searchLower)) hit = true;
                    if (row.pixivUser.account?.toLowerCase().includes(searchLower)) hit = true;
                }
            }

            // Check Tags (Tag Match Logic)
            if (!hit && tagMatchedPostIds) {
                if (row.post && tagMatchedPostIds.has(row.post.id)) {
                    hit = true;
                }
            }

            // Check Source Name
            if (!hit && row.source) {
                if (row.source.name?.toLowerCase().includes(searchLower)) hit = true;
            }

            if (!hit) return false;
        }

        return true;
    });

    // 5. Sort Groups
    const sortBy = filters?.sortBy || 'created-desc';

    filtered.sort((a, b) => {
        // Use group's primary item/post for sorting
        switch (sortBy) {
            case 'created-asc': // Oldest Imported First
                const cDateA = new Date(a.post?.createdAt || a.item.capturedAt || 0).getTime();
                const cDateB = new Date(b.post?.createdAt || b.item.capturedAt || 0).getTime();
                return cDateA - cDateB;

            case 'created-desc': // Newest Imported First
            default:
                const cDateA2 = new Date(a.post?.createdAt || a.item.capturedAt || 0).getTime();
                const cDateB2 = new Date(b.post?.createdAt || b.item.capturedAt || 0).getTime();
                return cDateB2 - cDateA2;

            case 'captured-asc': // Oldest Content First
                const capDateA = new Date(a.post?.date || a.item.capturedAt || 0).getTime();
                const capDateB = new Date(b.post?.date || b.item.capturedAt || 0).getTime();
                return capDateA - capDateB;

            case 'captured-desc': // Newest Content First
                const capDateA2 = new Date(a.post?.date || a.item.capturedAt || 0).getTime();
                const capDateB2 = new Date(b.post?.date || b.item.capturedAt || 0).getTime();
                return capDateB2 - capDateA2;
        }
    });

    return filtered;
}

export type TimelinePost = {
    id: string; // Unique ID for the post group
    type: 'twitter' | 'pixiv' | 'other';
    internalDbId?: number; // DB ID (auto-increment) for linking to tags
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
    gelbooruMetadata?: {
        tags: string[];
        source?: string;
        md5?: string;
    };
};

export async function getTimelinePosts(page = 1, limit = 20, search = ''): Promise<TimelinePost[]> {
    // 1. Parse Search Query similar to getMediaItems
    let searchQuery = search || '';
    let minFavorites = 0;

    const favsMatch = searchQuery.match(/(?:favs|min_favs):(\d+)/i);
    if (favsMatch) {
        minFavorites = parseInt(favsMatch[1], 10);
        searchQuery = searchQuery.replace(favsMatch[0], '').trim();
    }

    let sourceFilter: string | null = null;
    const sourceMatch = searchQuery.match(/source:([a-zA-Z0-9_-]+)/i);
    if (sourceMatch) {
        sourceFilter = sourceMatch[1].toLowerCase();
        searchQuery = searchQuery.replace(sourceMatch[0], '').trim();
    }

    // Helper: fetch matching tags first
    let tagMatchedPostIds: Set<number> | null = null;
    if (searchQuery.length > 1) {
        const searchLower = searchQuery.toLowerCase();
        const matchedTags = await db.selectDistinct({
            postId: postTags.postId
        })
            .from(tags)
            .innerJoin(postTags, eq(tags.id, postTags.tagId))
            .where(like(tags.name, `%${searchLower}%`));

        if (matchedTags.length > 0) {
            tagMatchedPostIds = new Set(matchedTags.map(m => m.postId));
        }
    }

    // 2. Fetch Posts (Paginated)
    // We should probably filter on DB level for performance, but we do it in memory for complex search matches for now.
    // However, pagination expects DB level or we fetch all?
    // Current implementation fetched all and sliced. We will do the same for consistency but optimized queries.

    let conditions: SQL | undefined = undefined;
    if (sourceFilter) {
        conditions = eq(posts.extractorType, sourceFilter);
    }

    // Select Posts + Details
    const rawPosts = await db.select({
        post: posts,
        twitter: postDetailsTwitter,
        pixiv: postDetailsPixiv,
        gelbooru: postDetailsGelbooruV02,
        user: twitterUsers,
        pixivUser: pixivUsers,
        source: sources,
    })
        .from(posts)
        .leftJoin(postDetailsTwitter, eq(posts.id, postDetailsTwitter.postId))
        .leftJoin(postDetailsPixiv, eq(posts.id, postDetailsPixiv.postId))
        .leftJoin(postDetailsGelbooruV02, eq(posts.id, postDetailsGelbooruV02.postId))
        .leftJoin(twitterUsers, and(eq(posts.extractorType, 'twitter'), eq(posts.userId, twitterUsers.id)))
        .leftJoin(pixivUsers, and(eq(posts.extractorType, 'pixiv'), eq(posts.userId, pixivUsers.id)))
        .leftJoin(sources, eq(posts.internalSourceId, sources.id))
        .where(conditions);

    // 3. Transform and Filter
    const filteredResults: (typeof rawPosts[number] & { stats?: TimelinePost['stats'] })[] = [];
    const searchLower = searchQuery.toLowerCase();

    for (const row of rawPosts) {
        let stats: TimelinePost['stats'] = undefined;
        let type: 'twitter' | 'pixiv' | 'other' = 'other';
        if (row.post.extractorType === 'twitter') type = 'twitter';
        else if (row.post.extractorType === 'pixiv') type = 'pixiv';

        if (type === 'twitter') {
            stats = {
                likes: row.twitter?.favoriteCount || 0,
                views: row.twitter?.viewCount || 0,
                bookmarks: row.twitter?.bookmarkCount || 0,
                retweets: row.twitter?.retweetCount || 0
            };
        } else if (type === 'pixiv') {
            stats = {
                likes: row.pixiv?.totalBookmarks || 0,
                views: row.pixiv?.totalView || 0,
            };
        } else if (row.post.extractorType === 'gelbooruv02') {
            stats = {
                likes: row.gelbooru?.score || 0,
            };
        }

        // Search Filter Check
        let hit = true;
        if (searchLower || minFavorites > 0) {
            // Min Favorites
            if (minFavorites > 0) {
                if ((stats?.likes || 0) < minFavorites) hit = false;
            }

            // Text Search
            if (hit && searchLower) {
                hit = false;
                // Check Author/Content
                const authorName = row.user?.name || row.pixivUser?.name || (row.post.extractorType === 'gelbooruv02' ? 'Gelbooru' : '');
                const authorNick = row.user?.nick || row.pixivUser?.account || '';

                if (authorName.toLowerCase().includes(searchLower)) hit = true;
                else if (authorNick.toLowerCase().includes(searchLower)) hit = true;
                else if (row.post.content?.toLowerCase().includes(searchLower)) hit = true;
                else if (row.post.title?.toLowerCase().includes(searchLower)) hit = true;

                // Check Tags
                if (!hit && tagMatchedPostIds && tagMatchedPostIds.has(row.post.id)) {
                    hit = true;
                }
            }
        }

        if (hit) {
            filteredResults.push({ ...row, stats });
        }
    }

    // 4. Sort and Paginate Posts
    filteredResults.sort((a, b) => {
        const dateA = new Date(a.post.date || a.post.createdAt || 0).getTime();
        const dateB = new Date(b.post.date || b.post.createdAt || 0).getTime();
        return dateB - dateA;
    });

    const start = (page - 1) * limit;
    const pagedResults = filteredResults.slice(start, start + limit);

    if (pagedResults.length === 0) return [];

    // 5. Fetch Media Items only for paged posts
    const pagedPostIds = pagedResults.map(r => r.post.id);
    const pageMedia = await db.select()
        .from(mediaItems)
        .where(and(
            ne(mediaItems.mediaType, 'text'),
            inArray(mediaItems.postId, pagedPostIds)
        ));

    const mediaMap = new Map<number, typeof pageMedia>();
    for (const m of pageMedia) {
        if (m.postId) {
            if (!mediaMap.has(m.postId)) mediaMap.set(m.postId, []);
            mediaMap.get(m.postId)!.push(m);
        }
    }

    // 6. Final Transformation
    const timelinePosts: TimelinePost[] = pagedResults.map(row => {
        let type: 'twitter' | 'pixiv' | 'other' = 'other';
        if (row.post.extractorType === 'twitter') type = 'twitter';
        else if (row.post.extractorType === 'pixiv') type = 'pixiv';

        let author: TimelinePost['author'] = undefined;
        let pixivMetadata: TimelinePost['pixivMetadata'] = undefined;
        let gelbooruMetadata: TimelinePost['gelbooruMetadata'] = undefined;

        if (type === 'twitter') {
            author = {
                name: row.user?.name || undefined,
                handle: row.user?.nick || undefined,
                avatar: row.user?.id ? `/api/avatar/twitter/${row.user.id}` : undefined,
                url: row.user ? `https://twitter.com/${row.user.nick}` : undefined
            };
        } else if (type === 'pixiv') {
            author = {
                name: row.pixivUser?.name || undefined,
                handle: row.pixivUser?.account || undefined,
                avatar: row.pixivUser?.id ? `/api/avatar/pixiv/${row.pixivUser.id}` : undefined,
                url: row.pixivUser ? `https://www.pixiv.net/users/${row.pixivUser.id}` : undefined
            };
            pixivMetadata = {
                dbId: row.post.id,
                illustId: parseInt(row.post.jsonSourceId || '0')
            };
        } else if (row.post.extractorType === 'gelbooruv02') {
            type = 'other';
            author = {
                name: 'Gelbooru',
                handle: row.gelbooru?.md5 || undefined
            };

            let parsedTags: string[] = [];
            if (row.gelbooru?.tags) {
                if (typeof row.gelbooru.tags === 'string') {
                    try {
                        parsedTags = JSON.parse(row.gelbooru.tags);
                    } catch {
                        parsedTags = [];
                    }
                } else if (Array.isArray(row.gelbooru.tags)) {
                    parsedTags = row.gelbooru.tags;
                }
            }

            gelbooruMetadata = {
                tags: parsedTags,
                source: row.gelbooru?.source || undefined,
                md5: row.gelbooru?.md5 || undefined
            };
        }

        const postMedia = mediaMap.get(row.post.id) || [];
        postMedia.sort((a, b) => a.filePath.localeCompare(b.filePath));

        return {
            id: `${type}-${row.post.jsonSourceId || row.post.id}`,
            type,
            internalDbId: row.post.id,
            date: new Date(row.post.date || row.post.createdAt || Date.now()),
            author,
            content: row.post.content || row.post.title || undefined,
            mediaItems: postMedia.map(m => ({
                id: m.id,
                url: m.filePath,
                type: m.mediaType as 'image' | 'video' | 'audio' | 'text',
                width: row.pixiv?.width || row.gelbooru?.width || undefined,
                height: row.pixiv?.height || row.gelbooru?.height || undefined
            })),
            stats: row.stats,
            sourceUrl: row.post.url || undefined,
            pixivMetadata,
            gelbooruMetadata
        };
    });

    return timelinePosts;
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
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error(`[deleteMediaItems] Failed to delete file: ${item.filePath}`, msg);
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
        // Tags used in most recently created posts
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

    // Default: Count
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

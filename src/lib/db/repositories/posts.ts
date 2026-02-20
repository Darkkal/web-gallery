import { db } from '@/lib/db';
import { posts, postDetailsTwitter, postDetailsPixiv, postDetailsGelbooruV02, twitterUsers, pixivUsers, sources, tags, postTags, mediaItems } from '@/lib/db/schema';
import { eq, ne, inArray, and, like, SQL } from 'drizzle-orm';
import { parseSearchQuery } from '@/lib/utils/search-parser';

export type TimelinePost = {
    id: string;
    type: 'twitter' | 'pixiv' | 'other';
    internalDbId?: number;
    date: Date;
    author?: {
        name?: string;
        handle?: string;
        avatar?: string;
        url?: string;
    };
    content?: string;
    mediaItems: {
        id: number;
        url: string;
        type: 'image' | 'video' | 'audio' | 'text';
        width?: number;
        height?: number;
    }[];
    stats?: {
        likes?: number;
        views?: number;
        bookmarks?: number;
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
    const { cleanQuery, minFavorites, sourceFilter } = parseSearchQuery(search);
    const searchLower = cleanQuery.toLowerCase();

    let tagMatchedPostIds: Set<number> | null = null;
    if (searchLower.length > 1) {
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

    let conditions: SQL | undefined = undefined;
    if (sourceFilter) {
        conditions = eq(posts.extractorType, sourceFilter);
    }

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

    const filteredResults: (typeof rawPosts[number] & { stats?: TimelinePost['stats'] })[] = [];

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

        let hit = true;
        if (searchLower || minFavorites > 0) {
            if (minFavorites > 0) {
                if ((stats?.likes || 0) < minFavorites) hit = false;
            }

            if (hit && searchLower) {
                hit = false;
                const authorName = row.user?.name || row.pixivUser?.name || (row.post.extractorType === 'gelbooruv02' ? 'Gelbooru' : '');
                const authorNick = row.user?.nick || row.pixivUser?.account || '';

                if (authorName.toLowerCase().includes(searchLower)) hit = true;
                else if (authorNick.toLowerCase().includes(searchLower)) hit = true;
                else if (row.post.content?.toLowerCase().includes(searchLower)) hit = true;
                else if (row.post.title?.toLowerCase().includes(searchLower)) hit = true;

                if (!hit && tagMatchedPostIds && tagMatchedPostIds.has(row.post.id)) {
                    hit = true;
                }
            }
        }

        if (hit) {
            filteredResults.push({ ...row, stats });
        }
    }

    filteredResults.sort((a, b) => {
        const dateA = new Date(a.post.date || a.post.createdAt || 0).getTime();
        const dateB = new Date(b.post.date || b.post.createdAt || 0).getTime();
        return dateB - dateA;
    });

    const start = (page - 1) * limit;
    const pagedResults = filteredResults.slice(start, start + limit);

    if (pagedResults.length === 0) return [];

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

export async function getPostTags(postId: number) {
    return await db.select({
        name: tags.name,
        id: tags.id
    })
        .from(postTags)
        .innerJoin(tags, eq(postTags.tagId, tags.id))
        .where(eq(postTags.postId, postId));
}

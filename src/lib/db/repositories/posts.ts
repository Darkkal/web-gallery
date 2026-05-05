import { db } from '@/lib/db';
import { posts, postDetailsTwitter, postDetailsPixiv, postDetailsGelbooruV02, twitterUsers, pixivUsers, sources, tags, postTags, mediaItems } from '@/lib/db/schema';
import { eq, ne, inArray, and, like, SQL, or, desc, asc, lt, gt, exists } from 'drizzle-orm';
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
    title?: string;
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
    sourceUrl?: string;
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

export async function getTimelinePosts(filters?: {
    search?: string;
    sortBy?: string;
    limit?: number;       // default 50
    cursor?: string;      // base64 encoded cursor for pagination
}): Promise<{ posts: TimelinePost[]; nextCursor: string | null }> {
    const limit = filters?.limit ?? 50;
    const search = filters?.search ?? '';
    const sortBy = filters?.sortBy ?? 'created-desc';

    const { cleanQuery, sourceFilter } = parseSearchQuery(search);
    const searchLower = cleanQuery.toLowerCase();

    const whereConditions: SQL[] = [];

    if (sourceFilter) {
        whereConditions.push(eq(posts.extractorType, sourceFilter));
    }

    if (searchLower) {
        const textMatch = or(
            like(posts.title, `%${searchLower}%`),
            like(posts.content, `%${searchLower}%`),
            like(twitterUsers.name, `%${searchLower}%`),
            like(twitterUsers.nick, `%${searchLower}%`),
            like(pixivUsers.name, `%${searchLower}%`),
            like(pixivUsers.account, `%${searchLower}%`),
            like(sources.name, `%${searchLower}%`)
        );

        const tagMatch = exists(
            db.select()
                .from(postTags)
                .innerJoin(tags, eq(postTags.tagId, tags.id))
                .where(
                    and(
                        eq(postTags.postId, posts.id),
                        like(tags.name, `%${searchLower}%`)
                    )
                )
        );

        whereConditions.push(or(textMatch, tagMatch)!);
    }

    let cursorSortVal: string | null = null;
    let cursorId: number | null = null;
    if (filters?.cursor) {
        try {
            const decoded = Buffer.from(filters?.cursor, 'base64').toString('utf-8');
            const lastUnderscore = decoded.lastIndexOf('_');
            if (lastUnderscore !== -1) {
                cursorSortVal = decoded.substring(0, lastUnderscore);
                cursorId = parseInt(decoded.substring(lastUnderscore + 1), 10);
            }
        } catch (e) {
            // Invalid cursor, ignore
        }
    }

    const orderBys: SQL[] = [];
    let cursorCond: SQL | undefined = undefined;

    if (sortBy === 'created-asc') {
        orderBys.push(asc(posts.createdAt), asc(posts.id));
        if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
            const dateVal = new Date(parseInt(cursorSortVal, 10));
            cursorCond = or(
                gt(posts.createdAt, dateVal),
                and(eq(posts.createdAt, dateVal), gt(posts.id, cursorId))
            );
        }
    } else if (sortBy === 'created-desc') {
        orderBys.push(desc(posts.createdAt), desc(posts.id));
        if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
            const dateVal = new Date(parseInt(cursorSortVal, 10));
            cursorCond = or(
                lt(posts.createdAt, dateVal),
                and(eq(posts.createdAt, dateVal), lt(posts.id, cursorId))
            );
        }
    } else if (sortBy === 'captured-asc') {
        orderBys.push(asc(posts.date), asc(posts.id));
        if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
            cursorCond = or(
                gt(posts.date, cursorSortVal),
                and(eq(posts.date, cursorSortVal), gt(posts.id, cursorId))
            );
        }
    } else { // captured-desc
        orderBys.push(desc(posts.date), desc(posts.id));
        if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
            cursorCond = or(
                lt(posts.date, cursorSortVal),
                and(eq(posts.date, cursorSortVal), lt(posts.id, cursorId))
            );
        }
    }

    if (cursorCond) {
        whereConditions.push(cursorCond);
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
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(...orderBys)
        .limit(limit);

    if (rawPosts.length === 0) return { posts: [], nextCursor: null };

    const pagedPostIds = rawPosts.map(r => r.post.id);
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

    const timelinePosts: TimelinePost[] = rawPosts.map(row => {
        let stats: TimelinePost['stats'] = undefined;
        let type: 'twitter' | 'pixiv' | 'other' = 'other';
        if (row.post.extractorType === 'twitter') type = 'twitter';
        else if (row.post.extractorType === 'pixiv') type = 'pixiv';

        let author: TimelinePost['author'] = undefined;
        let pixivMetadata: TimelinePost['pixivMetadata'] = undefined;
        let gelbooruMetadata: TimelinePost['gelbooruMetadata'] = undefined;

        if (type === 'twitter') {
            stats = {
                likes: row.twitter?.favoriteCount || 0,
                views: row.twitter?.viewCount || 0,
                bookmarks: row.twitter?.bookmarkCount || 0,
                retweets: row.twitter?.retweetCount || 0
            };
            author = {
                name: row.user?.name || undefined,
                handle: row.user?.nick || undefined,
                avatar: row.user?.id ? `/api/avatar/twitter/${row.user.id}` : undefined,
                url: row.user ? `https://twitter.com/${row.user.nick}` : undefined
            };
        } else if (type === 'pixiv') {
            stats = {
                likes: row.pixiv?.totalBookmarks || 0,
                views: row.pixiv?.totalView || 0,
            };
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
            stats = {
                likes: row.gelbooru?.score || 0,
            };
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
            title: row.post.title || undefined,
            content: row.post.content || row.post.title || undefined,
            mediaItems: postMedia.map(m => ({
                id: m.id,
                url: m.filePath,
                type: m.mediaType as 'image' | 'video' | 'audio' | 'text',
                width: row.pixiv?.width || row.gelbooru?.width || undefined,
                height: row.pixiv?.height || row.gelbooru?.height || undefined
            })),
            stats,
            sourceUrl: row.post.url || undefined,
            pixivMetadata,
            gelbooruMetadata
        };
    });

    let nextCursor: string | null = null;
    if (rawPosts.length === limit) {
        const lastItem = rawPosts[rawPosts.length - 1];
        let sortValStr = '';
        if (sortBy === 'created-asc' || sortBy === 'created-desc') {
            sortValStr = lastItem.post.createdAt?.getTime().toString() || '0';
        } else {
            sortValStr = lastItem.post.date || '';
        }
        nextCursor = Buffer.from(`${sortValStr}_${lastItem.post.id}`).toString('base64');
    }

    return { posts: timelinePosts, nextCursor };
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

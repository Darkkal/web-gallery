import { db } from '@/lib/db';
import { mediaItems, posts, postDetailsTwitter, postDetailsPixiv, postDetailsGelbooruV02, twitterUsers, pixivUsers, sources, tags, postTags, collectionItems } from '@/lib/db/schema';
import { eq, ne, inArray, and, like, SQL } from 'drizzle-orm';
import { parseSearchQuery } from '@/lib/utils/search-parser';
import fs from 'fs/promises';
import path from 'path';

export async function getMediaItems(
    filters?: {
        search?: string;
        sortBy?: string;
    }
) {
    const { cleanQuery, minFavorites, sourceFilter } = parseSearchQuery(filters?.search);
    const searchLower = cleanQuery.toLowerCase();

    let conditions: SQL | undefined = ne(mediaItems.mediaType, 'text');

    if (sourceFilter) {
        conditions = and(conditions, eq(posts.extractorType, sourceFilter));
    }

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
        .leftJoin(posts, eq(mediaItems.postId, posts.id))
        .leftJoin(postDetailsTwitter, eq(posts.id, postDetailsTwitter.postId))
        .leftJoin(postDetailsPixiv, eq(posts.id, postDetailsPixiv.postId))
        .leftJoin(postDetailsGelbooruV02, eq(posts.id, postDetailsGelbooruV02.postId))
        .leftJoin(twitterUsers, and(
            eq(posts.extractorType, 'twitter'),
            eq(posts.userId, twitterUsers.id)
        ))
        .leftJoin(pixivUsers, and(
            eq(posts.extractorType, 'pixiv'),
            eq(posts.userId, pixivUsers.id)
        ))
        .leftJoin(sources, eq(posts.internalSourceId, sources.id))
        .where(conditions);

    results.forEach(row => {
        if (row.user && row.user.id) {
            row.user.profileImage = `/api/avatar/twitter/${row.user.id}`;
        }
        if (row.pixivUser && row.pixivUser.id) {
            row.pixivUser.profileImage = `/api/avatar/pixiv/${row.pixivUser.id}`;
        }
    });

    type GroupedResult = typeof results[number] & {
        groupItems: typeof results[number][];
        groupCount: number;
    };

    const groupedMap = new Map<string, GroupedResult>();

    for (const row of results) {
        const key = row.post ? `p_${row.post.id}` : `i_${row.item.id}`;

        if (!groupedMap.has(key)) {
            groupedMap.set(key, {
                ...row,
                groupItems: [],
                groupCount: 0
            });
        }

        const group = groupedMap.get(key)!;
        group.groupItems.push(row);
        group.groupCount++;
    }

    const groupedResults = Array.from(groupedMap.values());

    const filtered = groupedResults.filter(row => {
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

        if (searchLower) {
            let hit = false;

            if (row.post) {
                if (row.post.title?.toLowerCase().includes(searchLower)) hit = true;
                if (row.post.content?.toLowerCase().includes(searchLower)) hit = true;
            }

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

            if (!hit && tagMatchedPostIds) {
                if (row.post && tagMatchedPostIds.has(row.post.id)) {
                    hit = true;
                }
            }

            if (!hit && row.source) {
                if (row.source.name?.toLowerCase().includes(searchLower)) hit = true;
            }

            if (!hit) return false;
        }

        return true;
    });

    const sortBy = filters?.sortBy || 'created-desc';

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'created-asc':
                const cDateA = new Date(a.post?.createdAt || a.item.capturedAt || 0).getTime();
                const cDateB = new Date(b.post?.createdAt || b.item.capturedAt || 0).getTime();
                return cDateA - cDateB;

            case 'created-desc':
            default:
                const cDateA2 = new Date(a.post?.createdAt || a.item.capturedAt || 0).getTime();
                const cDateB2 = new Date(b.post?.createdAt || b.item.capturedAt || 0).getTime();
                return cDateB2 - cDateA2;

            case 'captured-asc':
                const capDateA = new Date(a.post?.date || a.item.capturedAt || 0).getTime();
                const capDateB = new Date(b.post?.date || b.item.capturedAt || 0).getTime();
                return capDateA - capDateB;

            case 'captured-desc':
                const capDateA2 = new Date(a.post?.date || a.item.capturedAt || 0).getTime();
                const capDateB2 = new Date(b.post?.date || b.item.capturedAt || 0).getTime();
                return capDateB2 - capDateA2;
        }
    });

    return filtered;
}

export async function deleteMediaItems(ids: number[], deleteFiles: boolean) {
    console.log(`[MediaRepository] Deleting ${ids.length} items (deleteFiles: ${deleteFiles})`);

    if (ids.length === 0) return { success: true, count: 0 };

    if (deleteFiles) {
        const itemsToDelete = await db.select({ filePath: mediaItems.filePath })
            .from(mediaItems)
            .where(inArray(mediaItems.id, ids));

        const publicRoot = path.resolve(process.cwd(), 'public');

        for (const item of itemsToDelete) {
            try {
                const absolutePath = path.resolve(publicRoot, item.filePath.replace(/^\//, ''));

                if (!absolutePath.startsWith(publicRoot)) {
                    console.error(`[MediaRepository] Security Check Failed: Path ${absolutePath} is outside public dir.`);
                    continue;
                }

                await fs.unlink(absolutePath);

                const ext = path.extname(item.filePath);
                const jsonPathStr = item.filePath.substring(0, item.filePath.length - ext.length) + '.json';
                const absoluteJsonPath = path.resolve(publicRoot, jsonPathStr.replace(/^\//, ''));

                if (!absoluteJsonPath.startsWith(publicRoot)) {
                    continue;
                }

                try {
                    await fs.access(absoluteJsonPath);
                    await fs.unlink(absoluteJsonPath);
                } catch {
                    // Ignore if missing
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[MediaRepository] Failed to delete file: ${item.filePath}`, msg);
            }
        }
    }

    db.delete(collectionItems).where(inArray(collectionItems.mediaItemId, ids)).run();
    const result = db.delete(mediaItems).where(inArray(mediaItems.id, ids)).run();

    return { success: true, count: result.changes };
}

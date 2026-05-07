import { db } from '@/lib/db';
import { mediaItems, posts, postDetailsTwitter, postDetailsPixiv, postDetailsGelbooruV02, twitterUsers, pixivUsers, sources, tags, postTags, collectionItems } from '@/lib/db/schema';
import { eq, ne, inArray, and, like, SQL, or, desc, asc, lt, gt, exists, sql } from 'drizzle-orm';
import { parseSearchQuery } from '@/lib/utils/search-parser';
import fs from 'fs/promises';
import path from 'path';

export async function getMediaItems(
    filters?: {
        search?: string;
        sortBy?: string;
        limit?: number;
        cursor?: string;
    }
) {
    const limit = filters?.limit ?? 50;
    const search = filters?.search ?? '';
    const sortBy = filters?.sortBy ?? 'created-desc';

    const { cleanQuery, sourceFilter } = parseSearchQuery(search);
    const searchLower = cleanQuery.toLowerCase();

    const whereConditions: SQL[] = [ne(mediaItems.mediaType, 'text')];

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

    let cursorSortVal: number | null = null;
    let cursorId: number | null = null;
    if (filters?.cursor) {
        try {
            const decoded = Buffer.from(filters.cursor, 'base64').toString('utf-8');
            const [valStr, idStr] = decoded.split('_');
            cursorSortVal = parseInt(valStr, 10);
            cursorId = parseInt(idStr, 10);
        } catch (e) {
            // Invalid cursor
        }
    }

    const orderBys: SQL[] = [];
    let cursorCond: SQL | undefined = undefined;

    // Use coalesce to get a numeric timestamp for sorting
    const sortField = sql`COALESCE(${posts.createdAt}, ${mediaItems.capturedAt}, 0)`;

    if (sortBy === 'created-asc' || sortBy === 'captured-asc') {
        orderBys.push(asc(sortField), asc(mediaItems.id));
        if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
            cursorCond = or(
                gt(sortField, cursorSortVal),
                and(eq(sortField, cursorSortVal), gt(mediaItems.id, cursorId))
            );
        }
    } else { // created-desc, captured-desc
        orderBys.push(desc(sortField), desc(mediaItems.id));
        if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
            cursorCond = or(
                lt(sortField, cursorSortVal),
                and(eq(sortField, cursorSortVal), lt(mediaItems.id, cursorId))
            );
        }
    }

    if (cursorCond) {
        whereConditions.push(cursorCond);
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
        sortVal: sortField // include sortVal to easily compute the next cursor
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
        .where(and(...whereConditions))
        .orderBy(...orderBys)
        .limit(limit);

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

    let nextCursor: string | null = null;
    if (results.length === limit) {
        const lastItem = results[results.length - 1];
        nextCursor = Buffer.from(`${lastItem.sortVal}_${lastItem.item.id}`).toString('base64');
    }

    // Return the items minus the internal sortVal to match the previous structure as closely as possible
    const items = Array.from(groupedMap.values()).map(g => {
        const { sortVal, ...rest } = g;
        return {
            ...rest,
            groupItems: g.groupItems.map(gi => {
                const { sortVal: _, ...giRest } = gi;
                return giRest;
            })
        };
    });

    return { items, nextCursor };
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

    await db.delete(collectionItems).where(inArray(collectionItems.mediaItemId, ids));
    await db.delete(mediaItems).where(inArray(mediaItems.id, ids));

    return { success: true, count: ids.length };
}

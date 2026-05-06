'use server';

import { db } from '@/lib/db';
import { tags, posts, postTags } from '@/lib/db/schema';
import { desc, count, sql, eq } from 'drizzle-orm';
import * as postsRepo from '@/lib/db/repositories/posts';

export async function getPostTags(postId: number) {
    return postsRepo.getPostTags(postId);
}

interface TagResult {
    name: string;
    count: number;
}

export async function getTopTags(sort: 'count' | 'new' | 'recent' = 'count'): Promise<TagResult[]> {
    if (sort === 'new') {
        const results = await db.select({
            name: tags.name,
            id: tags.id
        })
            .from(tags)
            .orderBy(desc(tags.id))
            .limit(100);
        return results.map(r => ({ name: r.name, count: 0 as number }));
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

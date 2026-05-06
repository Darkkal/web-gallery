'use server';

import { db } from '@/lib/db';
import { tags, posts, postTags } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { desc, count, sql, eq } from 'drizzle-orm';

import * as mediaRepo from '@/lib/db/repositories/media';
import * as postsRepo from '@/lib/db/repositories/posts';

export async function getPostTags(postId: number) {
    return postsRepo.getPostTags(postId);
}

export async function getMediaItems(filters?: { search?: string; sortBy?: string; limit?: number; cursor?: string; }) {
    return mediaRepo.getMediaItems(filters);
}

export type { TimelinePost } from '@/lib/db/repositories/posts';

export async function getTimelinePosts(filters?: { search?: string; sortBy?: string; limit?: number; cursor?: string; }) {
    return postsRepo.getTimelinePosts(filters);
}

export async function deleteMediaItems(ids: number[], deleteFiles: boolean) {
    const result = await mediaRepo.deleteMediaItems(ids, deleteFiles);
    revalidatePath('/gallery');
    revalidatePath('/timeline');
    revalidatePath('/');
    return result;
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

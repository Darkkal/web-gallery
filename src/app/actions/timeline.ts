'use server';

import * as postsRepo from '@/lib/db/repositories/posts';

export type { TimelinePost } from '@/lib/db/repositories/posts';

export async function getTimelinePosts(filters?: { search?: string; sortBy?: string; limit?: number; cursor?: string; }) {
    return postsRepo.getTimelinePosts(filters);
}

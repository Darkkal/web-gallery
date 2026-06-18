"use server";

import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as postsRepo from "@/lib/db/repositories/posts";
import { incrementStatistics } from "@/lib/db/repositories/statistics";
import * as tagsRepo from "@/lib/db/repositories/tags";
import { posts, postTags, tags } from "@/lib/db/schema";

export async function getPostTags(postId: number) {
  return postsRepo.getPostTags(postId);
}

interface TagResult {
  name: string;
  count: number;
}

export async function getTopTags(
  sort: "count" | "new" | "recent" = "count",
): Promise<TagResult[]> {
  if (sort === "new") {
    const results = await db
      .select({
        name: tags.name,
        count: count(postTags.tagId),
      })
      .from(tags)
      .leftJoin(postTags, eq(tags.id, postTags.tagId))
      .leftJoin(posts, eq(postTags.postId, posts.id))
      .where(isNull(posts.deletedAt))
      .groupBy(tags.id)
      .orderBy(desc(tags.id))
      .limit(100);
    return results;
  }

  if (sort === "recent") {
    const results = await db
      .select({
        name: tags.name,
        lastDate: sql<string>`MAX(${posts.date})`,
        count: count(postTags.tagId),
      })
      .from(tags)
      .innerJoin(postTags, eq(tags.id, postTags.tagId))
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(isNull(posts.deletedAt))
      .groupBy(tags.id)
      .orderBy(desc(sql`MAX(${posts.date})`))
      .limit(100);

    return results;
  }

  const results = await db
    .select({
      name: tags.name,
      count: count(postTags.tagId),
    })
    .from(tags)
    .innerJoin(postTags, eq(tags.id, postTags.tagId))
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .where(isNull(posts.deletedAt))
    .groupBy(tags.id)
    .orderBy(desc(count(postTags.tagId)))
    .limit(100);

  return results;
}

export async function addTagToPost(postId: number, tagName: string) {
  const trimmed = tagName.trim();
  if (!trimmed) {
    throw new Error("Tag name cannot be empty");
  }
  if (trimmed.length > 200) {
    throw new Error("Tag name cannot exceed 200 characters");
  }

  const { tag, isNew } = await tagsRepo.createOrFindTag(trimmed);
  await tagsRepo.linkTagToPost(tag.id, postId);

  if (isNew) {
    await incrementStatistics({ totalTags: 1 });
  }

  return tag;
}

export async function removeTagFromPost(postId: number, tagId: number) {
  const unlinked = await tagsRepo.unlinkTagFromPost(tagId, postId);
  return unlinked;
}

export async function removeTagsFromPost(postId: number, tagIds: number[]) {
  if (tagIds.length === 0) return true;
  const deletedCount = await tagsRepo.unlinkTagsFromPost(tagIds, postId);
  return deletedCount > 0;
}

export async function bulkAddTagToPosts(postIds: number[], tagName: string) {
  const trimmed = tagName.trim();
  if (!trimmed) {
    throw new Error("Tag name cannot be empty");
  }
  if (trimmed.length > 200) {
    throw new Error("Tag name cannot exceed 200 characters");
  }
  if (postIds.length === 0) {
    return { tag: null, linkedCount: 0 };
  }

  const { tag, isNew } = await tagsRepo.createOrFindTag(trimmed);
  const linkedCount = await tagsRepo.bulkLinkTagToPosts(tag.id, postIds);

  if (isNew) {
    await incrementStatistics({ totalTags: 1 });
  }

  return { tag, linkedCount };
}

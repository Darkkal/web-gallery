import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { postTags, tags } from "@/lib/db/schema";

/**
 * Inserts a tag if it doesn't exist, and returns the tag record (id and name).
 */
export async function createOrFindTag(
  name: string,
): Promise<{ tag: { id: number; name: string }; isNew: boolean }> {
  const result = await db
    .insert(tags)
    .values({ name })
    .onConflictDoNothing()
    .returning();

  const isNew = result.length > 0;

  const tag = await db.query.tags.findFirst({
    where: eq(tags.name, name),
  });

  if (!tag) {
    throw new Error(`Failed to find or create tag: ${name}`);
  }

  return { tag, isNew };
}

/**
 * Links a tag to a post if not already linked.
 * Returns true if a new link was created, false otherwise.
 */
export async function linkTagToPost(
  tagId: number,
  postId: number,
): Promise<boolean> {
  const result = await db
    .insert(postTags)
    .values({ tagId, postId })
    .onConflictDoNothing()
    .returning();

  return result.length > 0;
}

/**
 * Unlinks a tag from a post.
 * Returns true if the link existed and was removed, false otherwise.
 */
export async function unlinkTagFromPost(
  tagId: number,
  postId: number,
): Promise<boolean> {
  const result = await db
    .delete(postTags)
    .where(and(eq(postTags.tagId, tagId), eq(postTags.postId, postId)))
    .returning();

  return result.length > 0;
}

/**
 * Bulk links a tag to multiple posts.
 * Returns the count of new links created.
 */
export async function bulkLinkTagToPosts(
  tagId: number,
  postIds: number[],
): Promise<number> {
  if (postIds.length === 0) return 0;

  const insertRows = postIds.map((postId) => ({
    tagId,
    postId,
  }));

  const result = await db
    .insert(postTags)
    .values(insertRows)
    .onConflictDoNothing()
    .returning();

  return result.length;
}

/**
 * Unlinks multiple tags from a post.
 * Returns the count of links removed.
 */
export async function unlinkTagsFromPost(
  tagIds: number[],
  postId: number,
): Promise<number> {
  if (tagIds.length === 0) return 0;

  const result = await db
    .delete(postTags)
    .where(and(inArray(postTags.tagId, tagIds), eq(postTags.postId, postId)))
    .returning();

  return result.length;
}

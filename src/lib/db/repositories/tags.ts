import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { postTags, tagCategories, tags } from "@/lib/db/schema";
import type { TagCategory } from "@/types/media";

/**
 * Inserts a tag if it doesn't exist, and returns the tag record (id, name, categoryId).
 */
export async function createOrFindTag(
  name: string,
  categoryId?: number | null,
): Promise<{
  tag: { id: number; name: string; categoryId: number | null };
  isNew: boolean;
}> {
  const result = await db
    .insert(tags)
    .values({ name, categoryId: categoryId ?? null })
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

/**
 * Retrieves all tag categories.
 */
export async function getAllCategories(): Promise<TagCategory[]> {
  return await db.select().from(tagCategories);
}

/**
 * Creates a new tag category.
 */
export async function createCategory(data: {
  name: string;
  colorHue: number;
  colorSaturation: number;
  colorLightness: number;
}): Promise<TagCategory> {
  const result = await db
    .insert(tagCategories)
    .values({
      name: data.name,
      colorHue: data.colorHue,
      colorSaturation: data.colorSaturation,
      colorLightness: data.colorLightness,
      isBuiltin: false,
    })
    .returning();
  return result[0];
}

/**
 * Updates a tag category's details (color, name).
 * Built-in categories cannot be renamed, but their colors can be edited.
 */
export async function updateCategory(
  id: number,
  data: Partial<{
    name: string;
    colorHue: number;
    colorSaturation: number;
    colorLightness: number;
  }>,
): Promise<TagCategory> {
  const [category] = await db
    .select()
    .from(tagCategories)
    .where(eq(tagCategories.id, id))
    .limit(1);

  if (!category) {
    throw new Error(`Category not found with id: ${id}`);
  }

  const updateData: any = {};
  if (data.colorHue !== undefined) updateData.colorHue = data.colorHue;
  if (data.colorSaturation !== undefined)
    updateData.colorSaturation = data.colorSaturation;
  if (data.colorLightness !== undefined)
    updateData.colorLightness = data.colorLightness;

  // Prevent renaming built-in categories
  if (data.name !== undefined) {
    if (category.isBuiltin) {
      throw new Error("Built-in categories cannot be renamed");
    }
    updateData.name = data.name;
  }

  const result = await db
    .update(tagCategories)
    .set(updateData)
    .where(eq(tagCategories.id, id))
    .returning();

  return result[0];
}

/**
 * Deletes a tag category. Built-in categories cannot be deleted.
 * Cascades are handled via schema reference setting to NULL.
 */
export async function deleteCategory(id: number): Promise<boolean> {
  const [category] = await db
    .select()
    .from(tagCategories)
    .where(eq(tagCategories.id, id))
    .limit(1);

  if (!category) {
    return false;
  }

  if (category.isBuiltin) {
    throw new Error("Built-in categories cannot be deleted");
  }

  const result = await db
    .delete(tagCategories)
    .where(eq(tagCategories.id, id))
    .returning();

  return result.length > 0;
}

/**
 * Assigns a category to a tag.
 */
export async function setTagCategory(
  tagId: number,
  categoryId: number | null,
): Promise<boolean> {
  const result = await db
    .update(tags)
    .set({ categoryId })
    .where(eq(tags.id, tagId))
    .returning();

  return result.length > 0;
}

/**
 * Bulk assigns a category to multiple tags.
 */
export async function bulkSetTagCategory(
  tagIds: number[],
  categoryId: number | null,
): Promise<number> {
  if (tagIds.length === 0) return 0;

  const result = await db
    .update(tags)
    .set({ categoryId })
    .where(inArray(tags.id, tagIds))
    .returning();

  return result.length;
}

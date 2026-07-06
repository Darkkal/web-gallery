import {
  aliasedTable,
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { postTags, tagCategories, tags } from "@/lib/db/schema";
import type {
  TagCategory,
  TagManageItem,
  TagWithCategory,
} from "@/types/media";
import { incrementStatistics } from "./statistics";

/**
 * Inserts a tag if it doesn't exist, and returns the tag record with its category (id, name, categoryId, category).
 */
export async function createOrFindTag(
  name: string,
  categoryId?: number | null,
): Promise<{
  tag: TagWithCategory;
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
    with: { category: true },
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

  // Explicitly set categoryId to null for all tags in this category to avoid FK constraint issues
  await db
    .update(tags)
    .set({ categoryId: null })
    .where(eq(tags.categoryId, id));

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
  const currentTag = await db.query.tags.findFirst({
    where: eq(tags.id, tagId),
  });
  if (!currentTag) {
    throw new Error(`Tag not found: ${tagId}`);
  }
  if (currentTag.aliasOfTagId !== null) {
    throw new Error(
      "Cannot directly set category on an alias tag. Set it on the canonical tag instead.",
    );
  }

  const result = await db
    .update(tags)
    .set({ categoryId })
    .where(or(eq(tags.id, tagId), eq(tags.aliasOfTagId, tagId)))
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

  const currentTags = await db
    .select({ id: tags.id, aliasOfTagId: tags.aliasOfTagId })
    .from(tags)
    .where(inArray(tags.id, tagIds));

  const hasAlias = currentTags.some((t) => t.aliasOfTagId !== null);
  if (hasAlias) {
    throw new Error(
      "Cannot directly set category on alias tags. Set it on canonical tags instead.",
    );
  }

  const result = await db
    .update(tags)
    .set({ categoryId })
    .where(or(inArray(tags.id, tagIds), inArray(tags.aliasOfTagId, tagIds)))
    .returning();

  return result.length;
}

/**
 * Retrieves a single tag by ID with category.
 */
export async function getTagById(
  tagId: number,
): Promise<TagWithCategory | null> {
  const tag = await db.query.tags.findFirst({
    where: eq(tags.id, tagId),
    with: { category: true },
  });
  return tag ?? null;
}

/**
 * Paginated tag list supporting search, category filter, and sorting.
 */
export async function getTagsPaginated(options?: {
  search?: string;
  category?: string | "all" | "uncategorized";
  sortBy?: "name" | "name-desc" | "count" | "count-asc";
  cursor?: string | null;
  limit?: number;
}): Promise<{
  items: TagManageItem[];
  nextCursor: string | null;
}> {
  const limit = options?.limit ?? 50;
  const search = options?.search ?? "";
  const category = options?.category ?? "all";
  const sortBy = options?.sortBy ?? "count";
  const cursor = options?.cursor;

  const tagCounts = db
    .select({
      id: tags.id,
      name: tags.name,
      categoryId: tags.categoryId,
      aliasOfTagId: tags.aliasOfTagId,
      postCount: sql<number>`count(${postTags.postId})`.as("postCount"),
    })
    .from(tags)
    .leftJoin(postTags, eq(tags.id, postTags.tagId))
    .groupBy(tags.id)
    .as("tag_counts");

  const whereConditions: SQL[] = [];

  if (search) {
    whereConditions.push(
      sql`lower(${tagCounts.name}) like ${`%${search.toLowerCase()}%`}`,
    );
  }

  if (category && category !== "all") {
    if (category === "none" || category === "uncategorized") {
      whereConditions.push(sql`${tagCounts.categoryId} is null`);
    } else {
      const categoryId = parseInt(category, 10);
      if (!isNaN(categoryId)) {
        whereConditions.push(eq(tagCounts.categoryId, categoryId));
      } else {
        whereConditions.push(eq(tagCategories.name, category));
      }
    }
  }

  let cursorSortVal: string | number | null = null;
  let cursorId: number | null = null;
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      const parts = decoded.split("_");
      if (parts.length >= 2) {
        cursorId = parseInt(parts[parts.length - 1], 10);
        const valStr = parts.slice(0, parts.length - 1).join("_");
        cursorSortVal = sortBy.startsWith("name")
          ? valStr
          : parseInt(valStr, 10);
      }
    } catch {
      // Invalid cursor
    }
  }

  const orderBys: SQL[] = [];
  let cursorCond: SQL | undefined;

  if (sortBy === "name") {
    orderBys.push(asc(tagCounts.name), asc(tagCounts.id));
    if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
      cursorCond = or(
        sql`lower(${tagCounts.name}) > ${String(cursorSortVal).toLowerCase()}`,
        and(
          sql`lower(${tagCounts.name}) = ${String(cursorSortVal).toLowerCase()}`,
          gt(tagCounts.id, cursorId),
        ),
      );
    }
  } else if (sortBy === "name-desc") {
    orderBys.push(desc(tagCounts.name), asc(tagCounts.id));
    if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
      cursorCond = or(
        sql`lower(${tagCounts.name}) < ${String(cursorSortVal).toLowerCase()}`,
        and(
          sql`lower(${tagCounts.name}) = ${String(cursorSortVal).toLowerCase()}`,
          gt(tagCounts.id, cursorId),
        ),
      );
    }
  } else if (sortBy === "count-asc") {
    orderBys.push(asc(tagCounts.postCount), asc(tagCounts.id));
    if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
      cursorCond = or(
        gt(tagCounts.postCount, Number(cursorSortVal)),
        and(
          eq(tagCounts.postCount, Number(cursorSortVal)),
          gt(tagCounts.id, cursorId),
        ),
      );
    }
  } else {
    // default "count" (post count desc)
    orderBys.push(desc(tagCounts.postCount), asc(tagCounts.id));
    if (cursorSortVal !== null && cursorId !== null && !isNaN(cursorId)) {
      cursorCond = or(
        lt(tagCounts.postCount, Number(cursorSortVal)),
        and(
          eq(tagCounts.postCount, Number(cursorSortVal)),
          gt(tagCounts.id, cursorId),
        ),
      );
    }
  }

  if (cursorCond) {
    whereConditions.push(cursorCond);
  }

  const aliasTags = aliasedTable(tags, "alias_tags");

  const results = await db
    .select({
      id: tagCounts.id,
      name: tagCounts.name,
      postCount: tagCounts.postCount,
      aliasOfTagId: tagCounts.aliasOfTagId,
      aliasName: aliasTags.name,
      category: {
        id: tagCategories.id,
        name: tagCategories.name,
        colorHue: tagCategories.colorHue,
        colorSaturation: tagCategories.colorSaturation,
        colorLightness: tagCategories.colorLightness,
        isBuiltin: tagCategories.isBuiltin,
      },
    })
    .from(tagCounts)
    .leftJoin(tagCategories, eq(tagCounts.categoryId, tagCategories.id))
    .leftJoin(aliasTags, eq(tagCounts.aliasOfTagId, aliasTags.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(...orderBys)
    .limit(limit);

  const items = results.map((row) => ({
    id: row.id,
    name: row.name,
    postCount: row.postCount,
    category: row.category?.id ? row.category : null,
    aliasOfTagId: row.aliasOfTagId,
    aliasName: row.aliasName,
  })) as TagManageItem[];

  let nextCursor: string | null = null;
  if (results.length === limit) {
    const lastItem = results[results.length - 1];
    let sortVal: string | number = 0;
    if (sortBy.startsWith("name")) {
      sortVal = lastItem.name;
    } else {
      sortVal = lastItem.postCount;
    }
    nextCursor = Buffer.from(`${sortVal}_${lastItem.id}`).toString("base64");
  }

  return { items, nextCursor };
}

/**
 * Renames a tag. Throws if the new name exists (unique index) or is empty.
 */
export async function renameTag(
  tagId: number,
  newName: string,
): Promise<TagWithCategory> {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("Tag name cannot be empty");
  }
  const result = await db
    .update(tags)
    .set({ name: trimmed })
    .where(eq(tags.id, tagId))
    .returning();

  if (result.length === 0) {
    throw new Error(`Tag not found with id: ${tagId}`);
  }

  const updatedTag = await db.query.tags.findFirst({
    where: eq(tags.id, tagId),
    with: { category: true },
  });

  if (!updatedTag) {
    throw new Error(`Failed to find tag after rename: ${tagId}`);
  }

  return updatedTag;
}

/**
 * Merges multiple source tags into a target tag.
 * Reassigns all post associations to the target tag, then deletes the sources.
 */
export async function mergeTags(
  sourceTagIds: number[],
  targetTagId: number,
): Promise<{ deletedCount: number; reassignedCount: number }> {
  if (sourceTagIds.length === 0) {
    return { deletedCount: 0, reassignedCount: 0 };
  }

  // Filter out the target tag ID from sources if it was accidentally included
  const sources = sourceTagIds.filter((id) => id !== targetTagId);
  if (sources.length === 0) {
    return { deletedCount: 0, reassignedCount: 0 };
  }

  // 1. Find all post IDs linked to the source tags
  const postsToReassign = await db
    .select({ postId: postTags.postId })
    .from(postTags)
    .where(inArray(postTags.tagId, sources));

  let reassignedCount = 0;
  if (postsToReassign.length > 0) {
    const insertRows = postsToReassign.map((row) => ({
      tagId: targetTagId,
      postId: row.postId,
    }));
    // Insert new links for the target tag (ignoring duplicates)
    const results = await db
      .insert(postTags)
      .values(insertRows)
      .onConflictDoNothing()
      .returning();
    reassignedCount = results.length;
  }

  // 2. Delete the source tags one by one
  let deletedCount = 0;
  for (const id of sources) {
    const deleteResult = await db
      .delete(tags)
      .where(eq(tags.id, id))
      .returning();
    if (deleteResult.length > 0) {
      deletedCount++;
    }
  }

  return {
    deletedCount,
    reassignedCount,
  };
}

/**
 * Deletes a single tag.
 */
export async function deleteTag(tagId: number): Promise<boolean> {
  const result = await db.delete(tags).where(eq(tags.id, tagId)).returning();
  return result.length > 0;
}

/**
 * Deletes multiple tags.
 */
export async function deleteTags(tagIds: number[]): Promise<number> {
  if (tagIds.length === 0) return 0;
  let deletedCount = 0;
  for (const id of tagIds) {
    const result = await db.delete(tags).where(eq(tags.id, id)).returning();
    if (result.length > 0) {
      deletedCount++;
    }
  }
  return deletedCount;
}

/**
 * Deletes all tags with no associated posts.
 */
export async function cleanupOrphanedTags(): Promise<number> {
  // Select all tags and all post_tags in memory to perform diff in JS
  const allTags = await db.select({ id: tags.id }).from(tags);
  const usedTags = await db.select({ tagId: postTags.tagId }).from(postTags);
  const usedSet = new Set(usedTags.map((t) => t.tagId));
  const orphans = allTags.filter((t) => !usedSet.has(t.id)).map((t) => t.id);

  if (orphans.length === 0) return 0;

  let deletedCount = 0;
  for (const id of orphans) {
    const result = await db.delete(tags).where(eq(tags.id, id)).returning();
    if (result.length > 0) {
      deletedCount++;
    }
  }
  return deletedCount;
}

/**
 * Sets a tag's alias to another tag.
 */
export async function setTagAlias(
  tagId: number,
  aliasOfTagId: number | null,
): Promise<boolean> {
  if (aliasOfTagId === tagId) {
    throw new Error("A tag cannot be an alias of itself");
  }

  let targetCategoryId: number | null = null;
  if (aliasOfTagId !== null) {
    const targetTag = await db.query.tags.findFirst({
      where: eq(tags.id, aliasOfTagId),
    });
    if (!targetTag) {
      throw new Error(`Target tag not found: ${aliasOfTagId}`);
    }
    if (targetTag.aliasOfTagId !== null) {
      throw new Error("Cannot alias to a tag that is itself an alias");
    }
    targetCategoryId = targetTag.categoryId;

    const existingAliases = await db
      .select({ count: sql<number>`count(*)` })
      .from(tags)
      .where(eq(tags.aliasOfTagId, tagId));
    if ((existingAliases[0]?.count ?? 0) > 0) {
      throw new Error(
        "Cannot alias this tag because other tags are already aliased to it. Clean up its aliases first.",
      );
    }
  }

  const currentTag = await db.query.tags.findFirst({
    where: eq(tags.id, tagId),
  });
  if (!currentTag) {
    throw new Error(`Tag not found: ${tagId}`);
  }

  const updateData: any = { aliasOfTagId };
  if (aliasOfTagId !== null) {
    updateData.categoryId = targetCategoryId;
  }

  const result = await db
    .update(tags)
    .set(updateData)
    .where(eq(tags.id, tagId))
    .returning();

  if (result.length > 0) {
    const wasCanonical = currentTag.aliasOfTagId === null;
    const isCanonical = aliasOfTagId === null;
    if (wasCanonical && !isCanonical) {
      await incrementStatistics({ totalCanonicalTags: -1 });
    } else if (!wasCanonical && isCanonical) {
      await incrementStatistics({ totalCanonicalTags: 1 });
    }
    return true;
  }
  return false;
}

/**
 * Bulk sets the alias for multiple tags.
 */
export async function bulkSetTagAlias(
  tagIds: number[],
  aliasOfTagId: number | null,
): Promise<number> {
  if (tagIds.length === 0) return 0;

  let targetCategoryId: number | null = null;
  if (aliasOfTagId !== null) {
    if (tagIds.includes(aliasOfTagId)) {
      throw new Error(
        "A tag cannot be aliased to itself or one of the tags being bulk-updated",
      );
    }
    const targetTag = await db.query.tags.findFirst({
      where: eq(tags.id, aliasOfTagId),
    });
    if (!targetTag) {
      throw new Error(`Target tag not found: ${aliasOfTagId}`);
    }
    if (targetTag.aliasOfTagId !== null) {
      throw new Error("Cannot alias to a tag that is itself an alias");
    }
    targetCategoryId = targetTag.categoryId;

    for (const tagId of tagIds) {
      const existingAliases = await db
        .select({ count: sql<number>`count(*)` })
        .from(tags)
        .where(eq(tags.aliasOfTagId, tagId));
      if ((existingAliases[0]?.count ?? 0) > 0) {
        throw new Error(
          "One or more selected tags cannot be aliased because other tags are already aliased to them.",
        );
      }
    }
  }

  const currentTags = await db
    .select({ id: tags.id, aliasOfTagId: tags.aliasOfTagId })
    .from(tags)
    .where(inArray(tags.id, tagIds));

  const updateData: any = { aliasOfTagId };
  if (aliasOfTagId !== null) {
    updateData.categoryId = targetCategoryId;
  }

  const result = await db
    .update(tags)
    .set(updateData)
    .where(inArray(tags.id, tagIds))
    .returning();

  if (result.length > 0) {
    let canonicalDiff = 0;
    const isCanonicalNow = aliasOfTagId === null;

    for (const tag of currentTags) {
      const wasCanonical = tag.aliasOfTagId === null;
      if (wasCanonical && !isCanonicalNow) {
        canonicalDiff--;
      } else if (!wasCanonical && isCanonicalNow) {
        canonicalDiff++;
      }
    }

    if (canonicalDiff !== 0) {
      await incrementStatistics({ totalCanonicalTags: canonicalDiff });
    }
  }

  return result.length;
}

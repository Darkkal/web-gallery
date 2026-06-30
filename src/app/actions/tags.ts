"use server";

import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as postsRepo from "@/lib/db/repositories/posts";
import { incrementStatistics } from "@/lib/db/repositories/statistics";
import * as tagsRepo from "@/lib/db/repositories/tags";
import { posts, postTags, tagCategories, tags } from "@/lib/db/schema";
import type { TagCategory } from "@/types/media";

export async function getPostTags(postId: number) {
  return postsRepo.getPostTags(postId);
}

export interface ActionTagResult {
  id: number;
  name: string;
  count: number;
  category: TagCategory | null;
}

export async function getTopTags(
  sort: "count" | "new" | "recent" = "count",
  categoryFilter: string = "all",
): Promise<ActionTagResult[]> {
  const conditions = [isNull(posts.deletedAt)];
  if (categoryFilter !== "all") {
    conditions.push(eq(tagCategories.name, categoryFilter));
  }

  if (sort === "new") {
    const results = await db
      .select({
        id: tags.id,
        name: tags.name,
        count: count(postTags.tagId),
        category: {
          id: tagCategories.id,
          name: tagCategories.name,
          colorHue: tagCategories.colorHue,
          colorSaturation: tagCategories.colorSaturation,
          colorLightness: tagCategories.colorLightness,
          isBuiltin: tagCategories.isBuiltin,
        },
      })
      .from(tags)
      .leftJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
      .leftJoin(postTags, eq(tags.id, postTags.tagId))
      .leftJoin(posts, eq(postTags.postId, posts.id))
      .where(and(...conditions))
      .groupBy(tags.id)
      .orderBy(desc(tags.id))
      .limit(100);

    return results.map((r) => ({
      id: r.id,
      name: r.name,
      count: r.count,
      category: r.category?.id ? (r.category as TagCategory) : null,
    }));
  }

  if (sort === "recent") {
    const results = await db
      .select({
        id: tags.id,
        name: tags.name,
        lastDate: sql<string>`MAX(${posts.date})`,
        count: count(postTags.tagId),
        category: {
          id: tagCategories.id,
          name: tagCategories.name,
          colorHue: tagCategories.colorHue,
          colorSaturation: tagCategories.colorSaturation,
          colorLightness: tagCategories.colorLightness,
          isBuiltin: tagCategories.isBuiltin,
        },
      })
      .from(tags)
      .leftJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
      .innerJoin(postTags, eq(tags.id, postTags.tagId))
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(and(...conditions))
      .groupBy(tags.id)
      .orderBy(desc(sql`MAX(${posts.date})`))
      .limit(100);

    return results.map((r) => ({
      id: r.id,
      name: r.name,
      count: r.count,
      category: r.category?.id ? (r.category as TagCategory) : null,
    }));
  }

  const results = await db
    .select({
      id: tags.id,
      name: tags.name,
      count: count(postTags.tagId),
      category: {
        id: tagCategories.id,
        name: tagCategories.name,
        colorHue: tagCategories.colorHue,
        colorSaturation: tagCategories.colorSaturation,
        colorLightness: tagCategories.colorLightness,
        isBuiltin: tagCategories.isBuiltin,
      },
    })
    .from(tags)
    .leftJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
    .innerJoin(postTags, eq(tags.id, postTags.tagId))
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .where(and(...conditions))
    .groupBy(tags.id)
    .orderBy(desc(count(postTags.tagId)))
    .limit(100);

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    count: r.count,
    category: r.category?.id ? (r.category as TagCategory) : null,
  }));
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

export async function getCategories(): Promise<TagCategory[]> {
  return tagsRepo.getAllCategories();
}

export async function createTagCategory(data: {
  name: string;
  colorHue: number;
  colorSaturation: number;
  colorLightness: number;
}): Promise<TagCategory> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Category name cannot be empty");
  }
  if (trimmedName.length > 50) {
    throw new Error("Category name cannot exceed 50 characters");
  }

  return tagsRepo.createCategory({
    name: trimmedName,
    colorHue: data.colorHue,
    colorSaturation: data.colorSaturation,
    colorLightness: data.colorLightness,
  });
}

export async function updateTagCategory(
  id: number,
  data: Partial<{
    name: string;
    colorHue: number;
    colorSaturation: number;
    colorLightness: number;
  }>,
): Promise<TagCategory> {
  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Category name cannot be empty");
    }
    if (trimmedName.length > 50) {
      throw new Error("Category name cannot exceed 50 characters");
    }
    data.name = trimmedName;
  }

  return tagsRepo.updateCategory(id, data);
}

export async function deleteTagCategory(id: number): Promise<boolean> {
  return tagsRepo.deleteCategory(id);
}

export async function setTagCategory(
  tagId: number,
  categoryId: number | null,
): Promise<boolean> {
  return tagsRepo.setTagCategory(tagId, categoryId);
}

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../../../../tests/unit/helpers/db";
import {
  seedBuiltinCategories,
  seedPost,
  seedSource,
  seedTag,
  seedTagCategory,
} from "../../../../tests/unit/helpers/seed";

let activeDb: ReturnType<typeof setupTestDb>["db"];

// Mock the db module to return our in-memory test db using a live getter
vi.mock("@/lib/db", () => {
  return {
    get db() {
      return activeDb;
    },
    initDb: vi.fn(),
  };
});

const testDbHelper = setupTestDb();
activeDb = testDbHelper.db;

// Import the module under test after vi.mock
import { eq } from "drizzle-orm";
import { postTags, tagCategories, tags } from "../schema";
import {
  bulkLinkTagToPosts,
  bulkSetTagCategory,
  cleanupOrphanedTags,
  createCategory,
  createOrFindTag,
  deleteCategory,
  deleteTag,
  deleteTags,
  getAllCategories,
  getTagById,
  getTagsPaginated,
  linkTagToPost,
  mergeTags,
  renameTag,
  setTagCategory,
  unlinkTagFromPost,
  unlinkTagsFromPost,
  updateCategory,
} from "./tags";

describe("Tags Repository", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  describe("createOrFindTag", () => {
    it("should create a new tag if it does not exist", async () => {
      const tagName = "new_tag";
      const { tag, isNew } = await createOrFindTag(tagName);

      expect(isNew).toBe(true);
      expect(tag.name).toBe(tagName);
      expect(tag.id).toBeTypeOf("number");

      // Verify in DB
      const result = await testDbHelper.db
        .select()
        .from(tags)
        .where(eq(tags.name, tagName));
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(tag.id);
    });

    it("should return the existing tag if it already exists", async () => {
      const tagName = "existing_tag";
      const first = await createOrFindTag(tagName);
      const second = await createOrFindTag(tagName);

      expect(first.isNew).toBe(true);
      expect(second.isNew).toBe(false);
      expect(second.tag.id).toBe(first.tag.id);
      expect(second.tag.name).toBe(tagName);
    });
  });

  describe("linkTagToPost", () => {
    it("should link a tag to a post", async () => {
      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      const { tag } = await createOrFindTag("test_tag");

      const linked = await linkTagToPost(tag.id, post.id);
      expect(linked).toBe(true);

      // Verify in DB
      const links = await testDbHelper.db
        .select()
        .from(postTags)
        .where(eq(postTags.postId, post.id));
      expect(links.length).toBe(1);
      expect(links[0].tagId).toBe(tag.id);
    });

    it("should return false if already linked", async () => {
      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      const { tag } = await createOrFindTag("test_tag");

      await linkTagToPost(tag.id, post.id);
      const linkedAgain = await linkTagToPost(tag.id, post.id);
      expect(linkedAgain).toBe(false);
    });
  });

  describe("unlinkTagFromPost", () => {
    it("should unlink a tag from a post", async () => {
      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      const { tag } = await createOrFindTag("test_tag");

      await linkTagToPost(tag.id, post.id);
      const unlinked = await unlinkTagFromPost(tag.id, post.id);
      expect(unlinked).toBe(true);

      // Verify in DB
      const links = await testDbHelper.db
        .select()
        .from(postTags)
        .where(eq(postTags.postId, post.id));
      expect(links.length).toBe(0);
    });

    it("should return false if link did not exist", async () => {
      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      const { tag } = await createOrFindTag("test_tag");

      const unlinked = await unlinkTagFromPost(tag.id, post.id);
      expect(unlinked).toBe(false);
    });
  });

  describe("bulkLinkTagToPosts", () => {
    it("should link a tag to multiple posts", async () => {
      const source = await seedSource(testDbHelper.db);
      const post1 = await seedPost(testDbHelper.db, source.id);
      const post2 = await seedPost(testDbHelper.db, source.id);
      const { tag } = await createOrFindTag("bulk_tag");

      // Link to post1 first to test onConflictDoNothing
      await linkTagToPost(tag.id, post1.id);

      const count = await bulkLinkTagToPosts(tag.id, [post1.id, post2.id]);
      expect(count).toBe(1); // Only 1 new link should be created (post2)

      const links = await testDbHelper.db
        .select()
        .from(postTags)
        .where(eq(postTags.tagId, tag.id));
      expect(links.length).toBe(2);
    });

    it("should return 0 if postIds array is empty", async () => {
      const { tag } = await createOrFindTag("empty_bulk_tag");
      const count = await bulkLinkTagToPosts(tag.id, []);
      expect(count).toBe(0);
    });
  });

  describe("unlinkTagsFromPost", () => {
    it("should unlink multiple tags from a post", async () => {
      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      const { tag: tag1 } = await createOrFindTag("tag1");
      const { tag: tag2 } = await createOrFindTag("tag2");
      const { tag: tag3 } = await createOrFindTag("tag3");

      await linkTagToPost(tag1.id, post.id);
      await linkTagToPost(tag2.id, post.id);
      await linkTagToPost(tag3.id, post.id);

      const count = await unlinkTagsFromPost([tag1.id, tag2.id], post.id);
      expect(count).toBe(2);

      const links = await testDbHelper.db
        .select()
        .from(postTags)
        .where(eq(postTags.postId, post.id));
      expect(links.length).toBe(1);
      expect(links[0].tagId).toBe(tag3.id);
    });

    it("should return 0 if tagIds array is empty", async () => {
      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      const count = await unlinkTagsFromPost([], post.id);
      expect(count).toBe(0);
    });
  });

  describe("createOrFindTag with categoryId", () => {
    it("should set categoryId on new tags, and preserve existing tag categoryId on conflict", async () => {
      const category = await seedTagCategory(testDbHelper.db, "character");
      const { tag, isNew } = await createOrFindTag(
        "character_tag",
        category.id,
      );
      expect(isNew).toBe(true);
      expect(tag.categoryId).toBe(category.id);

      const otherCategory = await seedTagCategory(testDbHelper.db, "artist");
      const secondCall = await createOrFindTag(
        "character_tag",
        otherCategory.id,
      );
      expect(secondCall.isNew).toBe(false);
      expect(secondCall.tag.categoryId).toBe(category.id); // Should preserve original character.id
    });
  });

  describe("getAllCategories", () => {
    it("should retrieve all categories including builtins", async () => {
      await seedBuiltinCategories(testDbHelper.db);
      await seedTagCategory(testDbHelper.db, "custom_cat");

      const cats = await getAllCategories();
      expect(cats.length).toBe(5);
      expect(cats.map((c) => c.name)).toContain("custom_cat");
      expect(cats.find((c) => c.name === "character")?.isBuiltin).toBe(true);
    });
  });

  describe("createCategory", () => {
    it("should create a custom category", async () => {
      const cat = await createCategory({
        name: "special",
        colorHue: 200,
        colorSaturation: 80,
        colorLightness: 50,
      });

      expect(cat.name).toBe("special");
      expect(cat.isBuiltin).toBe(false);
      expect(cat.colorHue).toBe(200);

      // Verify in DB
      const result = await testDbHelper.db
        .select()
        .from(tagCategories)
        .where(eq(tagCategories.name, "special"));
      expect(result.length).toBe(1);
    });
  });

  describe("updateCategory", () => {
    it("should update custom category colors and name", async () => {
      const cat = await seedTagCategory(testDbHelper.db, "custom");
      const updated = await updateCategory(cat.id, {
        name: "renamed-custom",
        colorHue: 100,
      });

      expect(updated.name).toBe("renamed-custom");
      expect(updated.colorHue).toBe(100);
    });

    it("should fail to rename a builtin category but allow updating its color", async () => {
      await seedBuiltinCategories(testDbHelper.db);
      const [character] = await testDbHelper.db
        .select()
        .from(tagCategories)
        .where(eq(tagCategories.name, "character"))
        .limit(1);

      await expect(
        updateCategory(character.id, { name: "not-character" }),
      ).rejects.toThrow("Built-in categories cannot be renamed");

      const updated = await updateCategory(character.id, { colorHue: 300 });
      expect(updated.colorHue).toBe(300);
      expect(updated.name).toBe("character");
    });
  });

  describe("deleteCategory", () => {
    it("should delete custom category and set referenced tag category_id to NULL", async () => {
      const cat = await seedTagCategory(testDbHelper.db, "custom");
      const tag = await seedTag(testDbHelper.db, "tagged", cat.id);

      const success = await deleteCategory(cat.id);
      expect(success).toBe(true);

      const dbTag = await testDbHelper.db
        .select()
        .from(tags)
        .where(eq(tags.id, tag.id))
        .limit(1);
      expect(dbTag[0].categoryId).toBeNull();
    });

    it("should fail to delete a builtin category", async () => {
      await seedBuiltinCategories(testDbHelper.db);
      const [character] = await testDbHelper.db
        .select()
        .from(tagCategories)
        .where(eq(tagCategories.name, "character"))
        .limit(1);

      await expect(deleteCategory(character.id)).rejects.toThrow(
        "Built-in categories cannot be deleted",
      );
    });
  });

  describe("setTagCategory", () => {
    it("should set category of a tag", async () => {
      const cat = await seedTagCategory(testDbHelper.db, "my-category");
      const tag = await seedTag(testDbHelper.db, "my-tag");

      const success = await setTagCategory(tag.id, cat.id);
      expect(success).toBe(true);

      const dbTag = await testDbHelper.db
        .select()
        .from(tags)
        .where(eq(tags.id, tag.id))
        .limit(1);
      expect(dbTag[0].categoryId).toBe(cat.id);
    });
  });

  describe("bulkSetTagCategory", () => {
    it("should set category on multiple tags", async () => {
      const cat = await seedTagCategory(testDbHelper.db, "bulk-category");
      const tag1 = await seedTag(testDbHelper.db, "t1");
      const tag2 = await seedTag(testDbHelper.db, "t2");

      const count = await bulkSetTagCategory([tag1.id, tag2.id], cat.id);
      expect(count).toBe(2);

      const dbTags = await testDbHelper.db
        .select()
        .from(tags)
        .where(eq(tags.categoryId, cat.id));
      expect(dbTags.length).toBe(2);
    });
  });

  describe("getTagById", () => {
    it("should retrieve a tag by ID with category", async () => {
      const cat = await seedTagCategory(testDbHelper.db, "character");
      const tag = await seedTag(testDbHelper.db, "test-tag", cat.id);

      const result = await getTagById(tag.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(tag.id);
      expect(result!.name).toBe("test-tag");
      expect(result!.category).not.toBeNull();
      expect(result!.category!.name).toBe("character");
    });

    it("should return null if tag does not exist", async () => {
      const result = await getTagById(9999);
      expect(result).toBeNull();
    });
  });

  describe("getTagsPaginated", () => {
    it("should fetch paginated tags with post counts and categories", async () => {
      const cat = await seedTagCategory(testDbHelper.db, "artist");
      const tag1 = await seedTag(testDbHelper.db, "tag-1", cat.id);
      const tag2 = await seedTag(testDbHelper.db, "tag-2");

      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      await linkTagToPost(tag1.id, post.id);

      const { items, nextCursor } = await getTagsPaginated({ limit: 10 });
      expect(items.length).toBe(2);

      const t1Item = items.find((i) => i.id === tag1.id);
      expect(t1Item).toBeDefined();
      expect(t1Item!.postCount).toBe(1);
      expect(t1Item!.category).not.toBeNull();
      expect(t1Item!.category!.name).toBe("artist");

      const t2Item = items.find((i) => i.id === tag2.id);
      expect(t2Item).toBeDefined();
      expect(t2Item!.postCount).toBe(0);
      expect(t2Item!.category).toBeNull();
    });

    it("should filter tags by search query", async () => {
      await seedTag(testDbHelper.db, "apple");
      await seedTag(testDbHelper.db, "banana");

      const { items } = await getTagsPaginated({ search: "ap" });
      expect(items.length).toBe(1);
      expect(items[0].name).toBe("apple");
    });

    it("should filter tags by category", async () => {
      const cat1 = await seedTagCategory(testDbHelper.db, "character");
      const cat2 = await seedTagCategory(testDbHelper.db, "artist");
      await seedTag(testDbHelper.db, "char-tag", cat1.id);
      await seedTag(testDbHelper.db, "art-tag", cat2.id);
      await seedTag(testDbHelper.db, "flat-tag");

      // Filter by category name
      const { items: charItems } = await getTagsPaginated({
        category: "character",
      });
      expect(charItems.length).toBe(1);
      expect(charItems[0].name).toBe("char-tag");

      // Filter by category ID
      const { items: artItems } = await getTagsPaginated({
        category: String(cat2.id),
      });
      expect(artItems.length).toBe(1);
      expect(artItems[0].name).toBe("art-tag");

      // Filter uncategorized
      const { items: uncatItems } = await getTagsPaginated({
        category: "uncategorized",
      });
      expect(uncatItems.length).toBe(1);
      expect(uncatItems[0].name).toBe("flat-tag");
    });

    it("should sort tags correctly", async () => {
      const tagA = await seedTag(testDbHelper.db, "apple");
      const tagB = await seedTag(testDbHelper.db, "banana");

      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      // Link apple to 1 post (postCount = 1)
      await linkTagToPost(tagA.id, post.id);

      // Sort by post count desc (default)
      const { items: countDesc } = await getTagsPaginated({ sortBy: "count" });
      expect(countDesc[0].id).toBe(tagA.id);

      // Sort by post count asc
      const { items: countAsc } = await getTagsPaginated({
        sortBy: "count-asc",
      });
      expect(countAsc[0].id).toBe(tagB.id);

      // Sort by name asc
      const { items: nameAsc } = await getTagsPaginated({ sortBy: "name" });
      expect(nameAsc[0].id).toBe(tagA.id);

      // Sort by name desc
      const { items: nameDesc } = await getTagsPaginated({
        sortBy: "name-desc",
      });
      expect(nameDesc[0].id).toBe(tagB.id);
    });

    it("should paginate correctly with cursors", async () => {
      const t1 = await seedTag(testDbHelper.db, "a");
      const t2 = await seedTag(testDbHelper.db, "b");
      const t3 = await seedTag(testDbHelper.db, "c");

      // Limit 1, sort name asc
      const page1 = await getTagsPaginated({ limit: 1, sortBy: "name" });
      expect(page1.items.length).toBe(1);
      expect(page1.items[0].id).toBe(t1.id);
      expect(page1.nextCursor).not.toBeNull();

      // Page 2 using cursor
      const page2 = await getTagsPaginated({
        limit: 1,
        sortBy: "name",
        cursor: page1.nextCursor,
      });
      expect(page2.items.length).toBe(1);
      expect(page2.items[0].id).toBe(t2.id);

      // Limit 1, sort count desc (all 0 posts)
      const page1C = await getTagsPaginated({ limit: 1, sortBy: "count" });
      expect(page1C.items.length).toBe(1);
      expect(page1C.nextCursor).not.toBeNull();

      const page2C = await getTagsPaginated({
        limit: 1,
        sortBy: "count",
        cursor: page1C.nextCursor,
      });
      expect(page2C.items.length).toBe(1);
    });
  });

  describe("renameTag", () => {
    it("should rename tag successfully", async () => {
      const tag = await seedTag(testDbHelper.db, "old-name");
      const renamed = await renameTag(tag.id, "new-name");
      expect(renamed.name).toBe("new-name");

      const dbTag = await getTagById(tag.id);
      expect(dbTag!.name).toBe("new-name");
    });

    it("should throw if name is empty", async () => {
      const tag = await seedTag(testDbHelper.db, "some-name");
      await expect(renameTag(tag.id, "   ")).rejects.toThrow(
        "Tag name cannot be empty",
      );
    });

    it("should throw if name already exists", async () => {
      const tag1 = await seedTag(testDbHelper.db, "name1");
      const tag2 = await seedTag(testDbHelper.db, "name2");
      await expect(renameTag(tag1.id, "name2")).rejects.toThrow();
    });
  });

  describe("mergeTags", () => {
    it("should merge source tags into target and transfer associations", async () => {
      const tSource1 = await seedTag(testDbHelper.db, "source1");
      const tSource2 = await seedTag(testDbHelper.db, "source2");
      const tTarget = await seedTag(testDbHelper.db, "target");

      const source = await seedSource(testDbHelper.db);
      const post1 = await seedPost(testDbHelper.db, source.id);
      const post2 = await seedPost(testDbHelper.db, source.id);

      // post1 has source1, post2 has source2
      await linkTagToPost(tSource1.id, post1.id);
      await linkTagToPost(tSource2.id, post2.id);

      // post1 also already has target (to verify de-duplication)
      await linkTagToPost(tTarget.id, post1.id);

      const result = await mergeTags([tSource1.id, tSource2.id], tTarget.id);
      expect(result.deletedCount).toBe(2);
      expect(result.reassignedCount).toBe(1); // Only post2 should be a new assignment since post1 already had target

      // Verify source tags are deleted
      const s1 = await getTagById(tSource1.id);
      const s2 = await getTagById(tSource2.id);
      expect(s1).toBeNull();
      expect(s2).toBeNull();

      // Verify post tags
      const post1Links = await testDbHelper.db
        .select()
        .from(postTags)
        .where(eq(postTags.postId, post1.id));
      expect(post1Links.length).toBe(1);
      expect(post1Links[0].tagId).toBe(tTarget.id);

      const post2Links = await testDbHelper.db
        .select()
        .from(postTags)
        .where(eq(postTags.postId, post2.id));
      expect(post2Links.length).toBe(1);
      expect(post2Links[0].tagId).toBe(tTarget.id);
    });
  });

  describe("deleteTag and deleteTags", () => {
    it("should delete single tag and cascade delete post links", async () => {
      const tag = await seedTag(testDbHelper.db, "to-delete");
      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      await linkTagToPost(tag.id, post.id);

      const success = await deleteTag(tag.id);
      expect(success).toBe(true);

      const dbTag = await getTagById(tag.id);
      expect(dbTag).toBeNull();

      const links = await testDbHelper.db
        .select()
        .from(postTags)
        .where(eq(postTags.tagId, tag.id));
      expect(links.length).toBe(0);
    });

    it("should delete multiple tags", async () => {
      const t1 = await seedTag(testDbHelper.db, "d1");
      const t2 = await seedTag(testDbHelper.db, "d2");

      const count = await deleteTags([t1.id, t2.id]);
      expect(count).toBe(2);

      const dbT1 = await getTagById(t1.id);
      expect(dbT1).toBeNull();
    });
  });

  describe("cleanupOrphanedTags", () => {
    it("should clean up tags with 0 posts", async () => {
      const usedTag = await seedTag(testDbHelper.db, "used");
      const orphanTag = await seedTag(testDbHelper.db, "orphan");

      const source = await seedSource(testDbHelper.db);
      const post = await seedPost(testDbHelper.db, source.id);
      await linkTagToPost(usedTag.id, post.id);

      const count = await cleanupOrphanedTags();
      expect(count).toBe(1);

      const dbUsed = await getTagById(usedTag.id);
      expect(dbUsed).not.toBeNull();

      const dbOrphan = await getTagById(orphanTag.id);
      expect(dbOrphan).toBeNull();
    });
  });
});

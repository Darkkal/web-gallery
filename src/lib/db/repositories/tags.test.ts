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
  createCategory,
  createOrFindTag,
  deleteCategory,
  getAllCategories,
  linkTagToPost,
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
      expect(cats.length).toBe(6);
      expect(cats.map((c) => c.name)).toContain("custom_cat");
      expect(cats.find((c) => c.name === "general")?.isBuiltin).toBe(true);
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
      const [general] = await testDbHelper.db
        .select()
        .from(tagCategories)
        .where(eq(tagCategories.name, "general"))
        .limit(1);

      await expect(
        updateCategory(general.id, { name: "not-general" }),
      ).rejects.toThrow("Built-in categories cannot be renamed");

      const updated = await updateCategory(general.id, { colorHue: 300 });
      expect(updated.colorHue).toBe(300);
      expect(updated.name).toBe("general");
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
      const [general] = await testDbHelper.db
        .select()
        .from(tagCategories)
        .where(eq(tagCategories.name, "general"))
        .limit(1);

      await expect(deleteCategory(general.id)).rejects.toThrow(
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
});

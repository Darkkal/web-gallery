import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../helpers/db";
import {
  seedBuiltinCategories,
  seedPost,
  seedSource,
  seedTag,
  seedTagCategory,
} from "../helpers/seed";

const testDbHelper = setupTestDb();

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

const testDb = testDbHelper.db;
activeDb = testDb;

import { eq } from "drizzle-orm";
import {
  addTagToPost,
  bulkAddTagToPosts,
  createTagCategory,
  deleteTagCategory,
  getCategories,
  getPostTags,
  getTopTags,
  removeTagFromPost,
  removeTagsFromPost,
  setTagCategory,
  updateTagCategory,
} from "@/app/actions/tags";
import { recomputeStatistics } from "@/lib/db/repositories/statistics";
import { postTags, tagCategories } from "@/lib/db/schema";

describe("Tags Server Actions", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  describe("getPostTags", () => {
    it("should return empty list if no tags linked", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const list = await getPostTags(post.id);
      expect(list.length).toBe(0);
    });
  });

  describe("addTagToPost", () => {
    it("should throw error on empty name", async () => {
      await expect(addTagToPost(1, "")).rejects.toThrow(
        "Tag name cannot be empty",
      );
    });

    it("should throw error on too long name", async () => {
      await expect(addTagToPost(1, "a".repeat(201))).rejects.toThrow(
        "Tag name cannot exceed 200 characters",
      );
    });

    it("should successfully add tag to post and update stats", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);

      // Setup statistics row
      await recomputeStatistics();

      const tag = await addTagToPost(post.id, "cool");
      expect(tag.name).toBe("cool");

      const postTagsList = await getPostTags(post.id);
      expect(postTagsList.length).toBe(1);
      expect(postTagsList[0].name).toBe("cool");
    });
  });

  describe("getTopTags", () => {
    it("should aggregate tags by count", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id);
      const post2 = await seedPost(testDb, source.id);

      const tag1 = await seedTag(testDb, "popular");
      const tag2 = await seedTag(testDb, "niche");

      await testDb.insert(postTags).values([
        { postId: post1.id, tagId: tag1.id },
        { postId: post2.id, tagId: tag1.id },
        { postId: post2.id, tagId: tag2.id },
      ]);

      const top = await getTopTags("count");
      expect(top.length).toBe(2);
      expect(top[0].name).toBe("popular");
      expect(top[0].count).toBe(2);
      expect(top[1].name).toBe("niche");
      expect(top[1].count).toBe(1);
    });

    it("should sort new tags by id descending", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);

      const tag1 = await seedTag(testDb, "old");
      const tag2 = await seedTag(testDb, "new");

      await testDb.insert(postTags).values([
        { postId: post.id, tagId: tag1.id },
        { postId: post.id, tagId: tag2.id },
      ]);

      const top = await getTopTags("new");
      expect(top.length).toBe(2);
      expect(top[0].name).toBe("new"); // newer tag has larger id, so first
    });

    it("should sort recent tags by post date", async () => {
      const source = await seedSource(testDb);
      const postOld = await seedPost(testDb, source.id, { date: "2026-01-01" });
      const postNew = await seedPost(testDb, source.id, { date: "2026-01-02" });

      const tagOld = await seedTag(testDb, "old-tag");
      const tagNew = await seedTag(testDb, "new-tag");

      await testDb.insert(postTags).values([
        { postId: postOld.id, tagId: tagOld.id },
        { postId: postNew.id, tagId: tagNew.id },
      ]);

      const top = await getTopTags("recent");
      expect(top.length).toBe(2);
      expect(top[0].name).toBe("new-tag"); // associated with postNew which has later date
    });
  });

  describe("removeTagFromPost", () => {
    it("should unlink a tag from a post", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const tag = await seedTag(testDb, "cool");

      await testDb.insert(postTags).values({ postId: post.id, tagId: tag.id });

      const unlinked = await removeTagFromPost(post.id, tag.id);
      expect(unlinked).toBe(true);

      const list = await getPostTags(post.id);
      expect(list.length).toBe(0);
    });
  });

  describe("removeTagsFromPost", () => {
    it("should unlink multiple tags from a post", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const tag1 = await seedTag(testDb, "cool");
      const tag2 = await seedTag(testDb, "awesome");

      await testDb.insert(postTags).values([
        { postId: post.id, tagId: tag1.id },
        { postId: post.id, tagId: tag2.id },
      ]);

      const success = await removeTagsFromPost(post.id, [tag1.id, tag2.id]);
      expect(success).toBe(true);

      const list = await getPostTags(post.id);
      expect(list.length).toBe(0);
    });
  });

  describe("bulkAddTagToPosts", () => {
    it("should bulk add tag to posts", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id);
      const post2 = await seedPost(testDb, source.id);

      await recomputeStatistics();

      const { tag, linkedCount } = await bulkAddTagToPosts(
        [post1.id, post2.id],
        "shared-tag",
      );
      expect(tag?.name).toBe("shared-tag");
      expect(linkedCount).toBe(2);

      const list1 = await getPostTags(post1.id);
      expect(list1.map((t) => t.name)).toContain("shared-tag");

      const list2 = await getPostTags(post2.id);
      expect(list2.map((t) => t.name)).toContain("shared-tag");
    });
  });

  describe("Category Actions", () => {
    it("should get categories", async () => {
      await seedBuiltinCategories(testDb);
      const cats = await getCategories();
      expect(cats.length).toBe(5);
      expect(cats.map((c) => c.name)).toContain("character");
    });

    it("should create custom tag category with validation", async () => {
      await expect(
        createTagCategory({
          name: "",
          colorHue: 0,
          colorSaturation: 0,
          colorLightness: 0,
        }),
      ).rejects.toThrow("Category name cannot be empty");

      await expect(
        createTagCategory({
          name: "a".repeat(51),
          colorHue: 0,
          colorSaturation: 0,
          colorLightness: 0,
        }),
      ).rejects.toThrow("Category name cannot exceed 50 characters");

      const cat = await createTagCategory({
        name: "custom",
        colorHue: 120,
        colorSaturation: 50,
        colorLightness: 50,
      });
      expect(cat.name).toBe("custom");
      expect(cat.isBuiltin).toBe(false);
    });

    it("should update tag category with validation", async () => {
      const cat = await seedTagCategory(testDb, "edit-me");

      await expect(updateTagCategory(cat.id, { name: "" })).rejects.toThrow(
        "Category name cannot be empty",
      );

      const updated = await updateTagCategory(cat.id, {
        name: "edited",
        colorHue: 240,
      });
      expect(updated.name).toBe("edited");
      expect(updated.colorHue).toBe(240);
    });

    it("should delete custom tag category", async () => {
      const cat = await seedTagCategory(testDb, "delete-me");
      const success = await deleteTagCategory(cat.id);
      expect(success).toBe(true);
    });

    it("should set tag category", async () => {
      const cat = await seedTagCategory(testDb, "target-cat");
      const tag = await seedTag(testDb, "some-tag");
      const success = await setTagCategory(tag.id, cat.id);
      expect(success).toBe(true);
    });
  });

  describe("getTopTags with category filtering", () => {
    it("should filter top tags by category name", async () => {
      const catCharacter = await seedTagCategory(testDb, "character");
      const catArtist = await seedTagCategory(testDb, "artist");

      const tagChar = await seedTag(testDb, "miku", catCharacter.id);
      const tagArt = await seedTag(testDb, "wlop", catArtist.id);

      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);

      await testDb.insert(postTags).values([
        { postId: post.id, tagId: tagChar.id },
        { postId: post.id, tagId: tagArt.id },
      ]);

      const filteredChar = await getTopTags("count", "character");
      expect(filteredChar.length).toBe(1);
      expect(filteredChar[0].name).toBe("miku");
      expect(filteredChar[0].category?.name).toBe("character");

      const filteredAll = await getTopTags("count", "all");
      expect(filteredAll.length).toBe(2);
    });
  });
});

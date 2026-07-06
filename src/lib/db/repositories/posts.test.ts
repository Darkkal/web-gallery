import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../../../../tests/unit/helpers/db";
import {
  seedPost,
  seedSource,
  seedTag,
  seedTagCategory,
} from "../../../../tests/unit/helpers/seed";

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
import { postTags, tags } from "../schema";
import { getPostTags, getTimelinePosts } from "./posts";

describe("Posts Repository", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  describe("getTimelinePosts", () => {
    it("should fetch posts and order by date desc by default", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id, {
        date: "2026-01-01T10:00:00Z",
      });
      const post2 = await seedPost(testDb, source.id, {
        date: "2026-01-02T10:00:00Z",
      });

      const { posts: list } = await getTimelinePosts();
      expect(list.length).toBe(2);
      expect(list[0].internalDbId).toBe(post2.id); // date desc, so post2 first
      expect(list[1].internalDbId).toBe(post1.id);
    });

    it("should handle cursor pagination correctly", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id, { date: "2026-01-01" });
      const post2 = await seedPost(testDb, source.id, { date: "2026-01-02" });
      const post3 = await seedPost(testDb, source.id, { date: "2026-01-03" });

      // Fetch first page, limit 1
      const res1 = await getTimelinePosts({ limit: 1 });
      expect(res1.posts.length).toBe(1);
      expect(res1.posts[0].internalDbId).toBe(post3.id);
      expect(res1.nextCursor).not.toBeNull();

      // Fetch second page using cursor
      const res2 = await getTimelinePosts({
        limit: 1,
        cursor: res1.nextCursor || undefined,
      });
      expect(res2.posts.length).toBe(1);
      expect(res2.posts[0].internalDbId).toBe(post2.id);
      expect(res2.nextCursor).not.toBeNull();

      // Fetch third page
      const res3 = await getTimelinePosts({
        limit: 1,
        cursor: res2.nextCursor || undefined,
      });
      expect(res3.posts.length).toBe(1);
      expect(res3.posts[0].internalDbId).toBe(post1.id);
      expect(res3.nextCursor).not.toBeNull();

      // Fetch fourth page (should be empty)
      const res4 = await getTimelinePosts({
        limit: 1,
        cursor: res3.nextCursor || undefined,
      });
      expect(res4.posts.length).toBe(0);
      expect(res4.nextCursor).toBeNull();
    });

    it("should filter by search query (FTS5)", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id, {
        title: "Special artwork",
        content: "Drawing some anime fans",
      });
      const _post2 = await seedPost(testDb, source.id, {
        title: "Normal landscape",
        content: "Drawing mountains and rivers",
      });

      // Search for "anime"
      const res1 = await getTimelinePosts({ search: "anime" });
      expect(res1.posts.length).toBe(1);
      expect(res1.posts[0].internalDbId).toBe(post1.id);

      // Search for "Drawing" (both have it)
      const res2 = await getTimelinePosts({ search: "Drawing" });
      expect(res2.posts.length).toBe(2);
    });

    it("should filter by extractor type using search query prefixes", async () => {
      const sourceTwitter = await seedSource(testDb, {
        extractorType: "twitter",
      });
      const sourcePixiv = await seedSource(testDb, { extractorType: "pixiv" });

      const postTwitter = await seedPost(testDb, sourceTwitter.id, {
        extractorType: "twitter",
      });
      const postPixiv = await seedPost(testDb, sourcePixiv.id, {
        extractorType: "pixiv",
      });

      const resTwitter = await getTimelinePosts({ search: "source:twitter" });
      expect(resTwitter.posts.length).toBe(1);
      expect(resTwitter.posts[0].internalDbId).toBe(postTwitter.id);

      const resPixiv = await getTimelinePosts({ search: "source:pixiv" });
      expect(resPixiv.posts.length).toBe(1);
      expect(resPixiv.posts[0].internalDbId).toBe(postPixiv.id);
    });

    it("should expand tag aliases bi-directionally in search query", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id, {
        title: "Artwork 1",
        content: "Contains a car",
        date: "2026-01-01",
      });
      const post2 = await seedPost(testDb, source.id, {
        title: "Artwork 2",
        content: "Contains an automobile",
        date: "2026-01-02",
      });

      const tagAutomobile = await seedTag(testDb, "automobile");
      const tagCar = await seedTag(testDb, "car");

      await testDb
        .update(tags)
        .set({ aliasOfTagId: tagAutomobile.id })
        .where(eq(tags.id, tagCar.id));

      await testDb.insert(postTags).values([
        { postId: post1.id, tagId: tagCar.id },
        { postId: post2.id, tagId: tagAutomobile.id },
      ]);

      const resCar = await getTimelinePosts({ search: "tag:car" });
      expect(resCar.posts.length).toBe(2);

      const resAuto = await getTimelinePosts({ search: "tag:automobile" });
      expect(resAuto.posts.length).toBe(2);
    });
  });

  describe("getPostTags", () => {
    it("should return the tags linked to a post", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const tag1 = await seedTag(testDb, "cool");
      const tag2 = await seedTag(testDb, "awesome");

      await testDb.insert(postTags).values([
        { postId: post.id, tagId: tag1.id },
        { postId: post.id, tagId: tag2.id },
      ]);

      const cat = await seedTagCategory(testDb, "artist");
      const list = await getPostTags(post.id);
      expect(list.length).toBe(2);
      expect(list.map((t) => t.name)).toContain("cool");
      expect(list.map((t) => t.name)).toContain("awesome");

      // Test with category set
      const tagWithCat = await seedTag(testDb, "categorized_tag", cat.id);
      await testDb
        .insert(postTags)
        .values({ postId: post.id, tagId: tagWithCat.id });
      const updatedList = await getPostTags(post.id);
      expect(updatedList.length).toBe(3);
      const target = updatedList.find((t) => t.name === "categorized_tag");
      expect(target).not.toBeUndefined();
      expect(target?.categoryId).toBe(cat.id);
      expect(target?.category?.name).toBe("artist");
    });
  });
});

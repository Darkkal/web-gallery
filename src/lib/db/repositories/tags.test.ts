import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../../../../tests/unit/helpers/db";
import { seedPost, seedSource } from "../../../../tests/unit/helpers/seed";

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
import { postTags, tags } from "../schema";
import {
  bulkLinkTagToPosts,
  createOrFindTag,
  linkTagToPost,
  unlinkTagFromPost,
  unlinkTagsFromPost,
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
});

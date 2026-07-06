import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../../../../tests/unit/helpers/db";
import {
  seedPixivUser,
  seedPost,
  seedSource,
  seedTag,
  seedTwitterUser,
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

// Import modules under test
import { eq } from "drizzle-orm";
import { postTags, tags } from "../schema";
import {
  autocompleteContent,
  autocompleteHandle,
  autocompleteSourceName,
  autocompleteTag,
  autocompleteTitle,
  autocompleteUser,
} from "./autocomplete";

describe("Autocomplete Repository", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  describe("autocompleteTag", () => {
    it("should autocomplete tags by prefix", async () => {
      await seedTag(testDb, "cats");
      await seedTag(testDb, "dogs");
      await seedTag(testDb, "cars");

      const suggestions = await autocompleteTag("ca");
      expect(suggestions.length).toBe(2);
      expect(suggestions.map((s) => s.value)).toContain("cats");
      expect(suggestions.map((s) => s.value)).toContain("cars");
    });

    it("should exclude already specified tags in context", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id, { title: "Test Post" });
      const tagCats = await seedTag(testDb, "cats");
      const tagCars = await seedTag(testDb, "cars");

      // Link both tags to the post
      await testDb.insert(postTags).values([
        { postId: post.id, tagId: tagCats.id },
        { postId: post.id, tagId: tagCars.id },
      ]);

      // Context includes "tag:cats", so it should find the post, show tagCars, but exclude tagCats
      const suggestions = await autocompleteTag("ca", 8, "tag:cats");
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].value).toBe("cars");
    });

    it("should filter tags by posts context if clean query exists", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id, {
        title: "Cute kittens drawing",
      });
      const tagCats = await seedTag(testDb, "cats");
      const _tagDogs = await seedTag(testDb, "dogs");

      // Link tags to post
      await testDb
        .insert(postTags)
        .values({ postId: post.id, tagId: tagCats.id });

      // With context "kittens" (post matches context search query)
      const suggestions = await autocompleteTag("c", 8, "kittens");
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].value).toBe("cats"); // cats is linked to the matched post
    });

    it("should return formatted alias suggestions with redirect label", async () => {
      const canonical = await seedTag(testDb, "automobile");
      const alias = await seedTag(testDb, "car");

      await testDb
        .update(tags)
        .set({ aliasOfTagId: canonical.id })
        .where(eq(tags.id, alias.id));

      const suggestions = await autocompleteTag("ca");
      const suggestion = suggestions.find((s) => s.value === "car");
      expect(suggestion).toBeDefined();
      expect(suggestion!.label).toBe("car → automobile");
    });

    it("should return the ancestors chain for suggestions", async () => {
      const parent = await seedTag(testDb, "animal");
      const child = await seedTag(testDb, "feline");
      const grandchild = await seedTag(testDb, "cat");

      await testDb
        .update(tags)
        .set({ parentTagId: parent.id })
        .where(eq(tags.id, child.id));
      await testDb
        .update(tags)
        .set({ parentTagId: child.id })
        .where(eq(tags.id, grandchild.id));

      const suggestions = await autocompleteTag("cat");
      const suggestion = suggestions.find((s) => s.value === "cat");
      expect(suggestion).toBeDefined();
      expect(suggestion!.ancestors).toEqual(["feline", "animal"]);
    });
  });

  describe("autocompleteUser", () => {
    it("should autocomplete users by name from both twitter and pixiv tables", async () => {
      await seedTwitterUser(testDb, "tw_1", {
        name: "Alice Twitter",
        nick: "alice_t",
      });
      await seedPixivUser(testDb, "px_1", {
        name: "Alice Pixiv",
        account: "alice_p",
      });
      await seedTwitterUser(testDb, "tw_2", {
        name: "Bob Twitter",
        nick: "bob_t",
      });

      const suggestions = await autocompleteUser("Ali");
      expect(suggestions.length).toBe(2);
      expect(suggestions.map((s) => s.value)).toContain("Alice Twitter");
      expect(suggestions.map((s) => s.value)).toContain("Alice Pixiv");
    });
  });

  describe("autocompleteHandle", () => {
    it("should autocomplete user handles from both platforms", async () => {
      await seedTwitterUser(testDb, "tw_1", { name: "Alice", nick: "alice_t" });
      await seedPixivUser(testDb, "px_1", { name: "Bob", account: "bob_p" });

      const suggestions = await autocompleteHandle("ali");
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].value).toBe("alice_t");
      expect(suggestions[0].label).toBe("@alice_t");
    });
  });

  describe("autocompleteSourceName", () => {
    it("should autocomplete source names", async () => {
      await seedSource(testDb, { name: "Gelbooru Cute Tags" });
      await seedSource(testDb, { name: "Pixiv Daily Rank" });

      const suggestions = await autocompleteSourceName("Gel");
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].value).toBe("Gelbooru Cute Tags");
    });
  });

  describe("autocompleteTitle", () => {
    it("should autocomplete post titles", async () => {
      const source = await seedSource(testDb);
      await seedPost(testDb, source.id, {
        title: "Beautiful Landscape Painting",
      });
      await seedPost(testDb, source.id, {
        title: "Beautiful Character Portrait",
      });

      const suggestions = await autocompleteTitle("Beau");
      expect(suggestions.length).toBe(2);
    });
  });

  describe("autocompleteContent", () => {
    it("should autocomplete post contents and truncate long labels", async () => {
      const source = await seedSource(testDb);
      const longText =
        "This is an extremely long post content that should be truncated when rendering autocomplete suggestions.";
      await seedPost(testDb, source.id, { content: longText });

      const suggestions = await autocompleteContent("This");
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].value).toBe(longText);
      expect(suggestions[0].label.length).toBe(53); // 50 chars + "..."
      expect(suggestions[0].label.endsWith("...")).toBe(true);
    });
  });
});

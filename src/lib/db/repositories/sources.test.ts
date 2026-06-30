import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../../../../tests/unit/helpers/db";
import {
  seedMediaItem,
  seedPost,
  seedSource,
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
import { scrapeHistory, sources } from "../schema";
import {
  addSource,
  deleteSource,
  getSourceById,
  getSources,
  getSourcesWithHistory,
  updateSource,
} from "./sources";

describe("Sources Repository", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  describe("addSource", () => {
    it("should parse Twitter URL and map to twitter extractor type", async () => {
      await addSource("https://twitter.com/dev_user", "My Twitter");

      const list = await testDb.select().from(sources);
      expect(list.length).toBe(1);
      expect(list[0].extractorType).toBe("twitter");
      expect(list[0].name).toBe("My Twitter");
      expect(list[0].url).toBe("https://twitter.com/dev_user");
    });

    it("should parse Pixiv URL and map to pixiv extractor type", async () => {
      await addSource("https://www.pixiv.net/users/12345");

      const list = await testDb.select().from(sources);
      expect(list.length).toBe(1);
      expect(list[0].extractorType).toBe("pixiv");
      expect(list[0].name).toBe("https://www.pixiv.net/users/12345"); // default name is url
    });

    it("should parse Gelbooru URL and map to gelbooruv02 extractor type", async () => {
      await addSource(
        "https://gelbooru.com/index.php?page=post&s=list&tags=all",
      );

      const list = await testDb.select().from(sources);
      expect(list.length).toBe(1);
      expect(list[0].extractorType).toBe("gelbooruv02");
    });

    it("should parse E-Hentai/ExHentai URLs correctly", async () => {
      await addSource("https://e-hentai.org/g/123/456");
      await addSource("https://exhentai.org/g/789/abc");

      const list = await testDb.select().from(sources);
      expect(list.length).toBe(2);
      expect(list[0].extractorType).toBe("ehentai");
      expect(list[1].extractorType).toBe("exhentai");
    });

    it("should map invalid/unknown URLs to fallback type", async () => {
      await addSource("invalid-url-string");

      const list = await testDb.select().from(sources);
      expect(list.length).toBe(1);
      expect(list[0].extractorType).toBe("gallery-dl");
    });
  });

  describe("CRUD operations", () => {
    it("should get, update, and soft delete a source", async () => {
      const source = await seedSource(testDb, { name: "Original Name" });

      // Get by id
      const fetched = await getSourceById(source.id);
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe("Original Name");

      // Update
      await updateSource(source.id, {
        name: "Updated Name",
        url: "https://new-url.com",
      });
      const updated = await getSourceById(source.id);
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.url).toBe("https://new-url.com");

      // Get active list (should be 1)
      let activeList = await getSources();
      expect(activeList.length).toBe(1);

      // Soft delete
      await deleteSource(source.id);
      const softDeleted = await getSourceById(source.id);
      expect(softDeleted).toBeUndefined(); // getSourceById ignores soft-deleted

      // Verify in raw DB that deletedAt is populated
      const raw = await testDb
        .select()
        .from(sources)
        .where(eq(sources.id, source.id));
      expect(raw[0].deletedAt).toBeInstanceOf(Date);

      // Active list should now be empty
      activeList = await getSources();
      expect(activeList.length).toBe(0);
    });
  });

  describe("getSourcesWithHistory", () => {
    it("should return sources with their latest scrape history and preview image", async () => {
      const source = await seedSource(testDb, { name: "Active Source" });
      const post = await seedPost(testDb, source.id);
      const _media = await seedMediaItem(testDb, post.id, {
        mediaType: "image",
        filePath: "/downloads/preview.jpg",
      });

      // Add scrape history
      const now = new Date();
      await testDb.insert(scrapeHistory).values({
        sourceId: source.id,
        startTime: now,
        status: "completed",
        filesDownloaded: 5,
        bytesDownloaded: 1000,
      });

      const list = await getSourcesWithHistory();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(source.id);
      expect(list[0].previewImage).toBe("/downloads/preview.jpg");
      expect(list[0].lastScrape).toBeDefined();
      expect(list[0].lastScrape?.status).toBe("completed");
    });
  });
});

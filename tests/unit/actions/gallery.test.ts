import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../helpers/db";
import { seedMediaItem, seedPost, seedSource } from "../helpers/seed";

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

// Mock next/cache
vi.mock("next/cache", () => {
  return {
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
  };
});

// Mock node:fs/promises to simulate files deletions
vi.mock("node:fs/promises", async () => {
  const actual =
    await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises",
    );
  return {
    ...actual,
    default: {
      ...actual,
      stat: async () => ({ size: 100 }),
      unlink: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock scraperManager to prevent real scraping and process spawns
vi.mock("@/lib/scrapers/manager", () => {
  return {
    scraperManager: {
      startScrape: vi.fn(),
    },
  };
});

const testDb = testDbHelper.db;
activeDb = testDb;

import { eq } from "drizzle-orm";
// Import modules under test
import { revalidatePath } from "next/cache";
import {
  deleteMediaItems,
  getMediaItems,
  refetchPostData,
} from "@/app/actions/gallery";
import { posts } from "@/lib/db/schema";
import { scraperManager } from "@/lib/scrapers/manager";

describe("Gallery Server Actions", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
    vi.mocked(revalidatePath).mockClear();
    vi.mocked(scraperManager.startScrape).mockClear();
  });

  describe("getMediaItems", () => {
    it("should retrieve media items", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media = await seedMediaItem(testDb, post.id);

      const res = await getMediaItems();
      expect(res.items.length).toBe(1);
      expect(res.items[0].groupItems[0].item.id).toBe(media.id);
    });
  });

  describe("deleteMediaItems", () => {
    it("should delete media items and trigger revalidation", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media = await seedMediaItem(testDb, post.id);

      const res = await deleteMediaItems([media.id], true);
      expect(res.success).toBe(true);

      // Verify db state
      const { items } = await getMediaItems();
      expect(items.length).toBe(0);

      // Verify path revalidation
      expect(revalidatePath).toHaveBeenCalledWith("/gallery");
      expect(revalidatePath).toHaveBeenCalledWith("/timeline");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("refetchPostData", () => {
    it("should skip posts without URLs", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id, { url: "" });

      const res = await refetchPostData([post.id]);
      expect(res.totalCount).toBe(1);
      expect(res.successCount).toBe(0);
      expect(res.deletedCount).toBe(0);
    });

    it("should run scrape successfully and flag post source as not deleted on success", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id, {
        url: "https://twitter.com/test/status/1",
      });

      // Mock startScrape to return success
      vi.mocked(scraperManager.startScrape).mockResolvedValue({
        success: true,
        output: "Scraped 1 file successfully",
        error: "",
        items: ["/downloads/1.jpg"],
        // biome-ignore lint/suspicious/noExplicitAny: mock return value is coerced
      } as any);

      const res = await refetchPostData([post.id]);
      expect(res.successCount).toBe(1);
      expect(res.deletedCount).toBe(0);

      const dbPost = await testDb.query.posts.findFirst({
        where: eq(posts.id, post.id),
      });
      expect(dbPost?.isSourceDeleted).toBe(false);
      expect(revalidatePath).toHaveBeenCalledWith("/gallery");
    });

    it("should detect deletion signatures and flag post source as deleted", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id, {
        url: "https://twitter.com/test/status/1",
      });

      // Mock startScrape to return a 404 deletion signature in the output
      vi.mocked(scraperManager.startScrape).mockResolvedValue({
        success: false,
        output: "HTTP Error 404: Not Found",
        error: "",
        items: [],
        // biome-ignore lint/suspicious/noExplicitAny: mock return value is coerced
      } as any);

      const res = await refetchPostData([post.id]);
      expect(res.successCount).toBe(0);
      expect(res.deletedCount).toBe(1);

      const dbPost = await testDb.query.posts.findFirst({
        where: eq(posts.id, post.id),
      });
      expect(dbPost?.isSourceDeleted).toBe(true);
    });
  });
});

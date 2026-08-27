import { sql } from "drizzle-orm";
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

// Mock node:fs/promises to simulate files deletions
vi.mock("node:fs/promises", async () => {
  const actual =
    await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises",
    );
  const statMock = async (_path: string) => {
    // biome-ignore lint/suspicious/noExplicitAny: mock return stat is any
    return { size: 500 } as any;
  };
  const unlinkMock = vi.fn().mockResolvedValue(undefined);
  const accessMock = vi.fn().mockResolvedValue(undefined);
  return {
    ...actual,
    default: {
      ...actual,
      stat: statMock,
      unlink: unlinkMock,
      access: accessMock,
    },
  };
});

// Mock statistics repo functions to prevent circular import problems
vi.mock("@/lib/db/repositories/statistics", () => {
  return {
    incrementStatistics: vi.fn().mockResolvedValue(undefined),
  };
});

const testDb = testDbHelper.db;
activeDb = testDb;

// Import modules under test
import fs from "node:fs/promises";
import { incrementStatistics } from "@/lib/db/repositories/statistics";
import {
  deleteMediaItems,
  getDynamicPlaylistMeta,
  getMediaItemById,
  getMediaItemIds,
  getMediaItems,
  getMediaItemsByIds,
  getPostMediaItems,
} from "./media";

describe("Media Repository", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
    vi.mocked(incrementStatistics).mockClear();
    if (fs.unlink) {
      vi.mocked(fs.unlink).mockClear();
    }
  });

  describe("getPostMediaItems", () => {
    it("should fetch all media items for a specific post ordered ascending by ID", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media1 = await seedMediaItem(testDb, post.id, {
        filePath: "/downloads/1.jpg",
      });
      const media2 = await seedMediaItem(testDb, post.id, {
        filePath: "/downloads/2.jpg",
      });

      const postMedia = await getPostMediaItems(post.id);
      expect(postMedia.length).toBe(2);
      expect(postMedia[0].item.id).toBe(media1.id);
      expect(postMedia[1].item.id).toBe(media2.id);
    });
  });

  describe("getMediaItems", () => {
    it("should fetch first media item per post as thumbnail with total groupCount", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media1 = await seedMediaItem(testDb, post.id, {
        filePath: "/downloads/1.jpg",
      });
      const _media2 = await seedMediaItem(testDb, post.id, {
        filePath: "/downloads/2.jpg",
      });

      const { items } = await getMediaItems();
      expect(items.length).toBe(1); // Grouped by post, so 1 group
      expect(items[0].groupCount).toBe(2);
      expect(items[0].item.id).toBe(media1.id); // Thumbnail is first media item
      expect(items[0].groupItems.length).toBe(1); // Initially contains first media item for lazy loading
      expect(items[0].groupItems[0].item.id).toBe(media1.id);
    });

    it("should handle cursor pagination correctly across unique posts", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id);
      const post2 = await seedPost(testDb, source.id);
      const _media1 = await seedMediaItem(testDb, post1.id, {
        createdAt: new Date("2026-01-01"),
      });
      const _media2 = await seedMediaItem(testDb, post2.id, {
        createdAt: new Date("2026-01-02"),
      });

      const res1 = await getMediaItems({ limit: 1 });
      expect(res1.items.length).toBe(1);
      expect(res1.nextCursor).not.toBeNull();

      const res2 = await getMediaItems({
        limit: 1,
        cursor: res1.nextCursor || undefined,
      });
      expect(res2.items.length).toBe(1);
      expect(res2.nextCursor).not.toBeNull();

      const res3 = await getMediaItems({
        limit: 1,
        cursor: res2.nextCursor || undefined,
      });
      expect(res3.items.length).toBe(0);
      expect(res3.nextCursor).toBeNull();
    });
  });

  describe("deleteMediaItems", () => {
    it("should delete media items from database only when deleteFiles is false", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media = await seedMediaItem(testDb, post.id);

      const res = await deleteMediaItems([media.id], false);
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);

      // Verify DB delete
      const { items } = await getMediaItems();
      expect(items.length).toBe(0);

      // Verify files were not unlinked
      expect(fs.unlink).not.toHaveBeenCalled();

      // Verify statistics were updated
      expect(incrementStatistics).toHaveBeenCalledWith({
        totalMediaItems: -1,
        storageBytes: -0,
      });
    });

    it("should delete media items from database and trigger physical unlinks when deleteFiles is true", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media = await seedMediaItem(testDb, post.id, {
        filePath: "/downloads/test.jpg",
      });

      const res = await deleteMediaItems([media.id], true);
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);

      // Verify files unlinks called for image and json metadata
      expect(fs.unlink).toHaveBeenCalledTimes(2); // test.jpg and test.json

      // Verify statistics were updated with calculated file sizes (2 files * 500 size = 1000)
      expect(incrementStatistics).toHaveBeenCalledWith({
        totalMediaItems: -1,
        storageBytes: -1000,
      });
    });
  });

  describe("getMediaItemIds & Lightweight Helpers", () => {
    it("should return lightweight media ID array and totalCount", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id);
      const post2 = await seedPost(testDb, source.id);
      const media1 = await seedMediaItem(testDb, post1.id);
      const media2 = await seedMediaItem(testDb, post2.id);

      const result = await getMediaItemIds();
      expect(result.totalCount).toBe(2);
      expect(result.ids).toContain(media1.id);
      expect(result.ids).toContain(media2.id);
    });

    it("should return dynamic playlist metadata efficiently", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const _media = await seedMediaItem(testDb, post.id, {
        filePath: "/downloads/sample.jpg",
      });

      const meta = await getDynamicPlaylistMeta("");
      expect(meta.itemCount).toBe(1);
      expect(meta.thumbnailPath).toBe("/downloads/sample.jpg");
    });

    it("should fetch media items in batch by IDs", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media = await seedMediaItem(testDb, post.id);

      const batchMap = await getMediaItemsByIds([media.id]);
      expect(batchMap[media.id]).toBeDefined();
      expect(batchMap[media.id].item.id).toBe(media.id);

      const single = await getMediaItemById(media.id);
      expect(single).toBeDefined();
      expect(single?.item.id).toBe(media.id);
    });
  });

  describe("gallery query index (#156)", () => {
    it("uses the expression index on the gallery group key (no temp b-tree for GROUP BY)", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      await seedMediaItem(testDb, post.id);
      await seedMediaItem(testDb, post.id);
      const standalone = await seedPost(testDb, source.id);
      await seedMediaItem(testDb, standalone.id);

      // The gallery read path groups media items by COALESCE(post_id, -id)
      // (#141). A bare post_id index cannot serve that expression; this test
      // pins that the schema ships an expression index on the exact group key
      // so the plan avoids a full-scan + temp b-tree per page (#156).
      const plans = await testDb.all(
        sql`EXPLAIN QUERY PLAN SELECT media_items.id, g.group_count
          FROM media_items
          INNER JOIN (SELECT MIN(media_items.id) AS min_id, COUNT(*) AS group_count
                      FROM media_items
                      WHERE media_items.media_type != 'text'
                      GROUP BY COALESCE(media_items.post_id, -media_items.id)) AS g
            ON media_items.id = g.min_id
          WHERE media_items.media_type != 'text'
          ORDER BY COALESCE(media_items.captured_at, media_items.created_at, 0) DESC, media_items.id DESC
          LIMIT 50`,
      );
      const details = (plans as Array<{ detail: string }>).map((p) => p.detail);
      expect(
        details.some((d) =>
          d.includes("USING INDEX idx_media_items_gallery_group"),
        ),
      ).toBe(true);
      expect(
        details.some((d) => d.includes("USE TEMP B-TREE FOR GROUP BY")),
      ).toBe(false);
    });
  });
});

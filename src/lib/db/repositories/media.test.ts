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
import { deleteMediaItems, getMediaItems } from "./media";

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

  describe("getMediaItems", () => {
    it("should fetch media items and return grouped by post showing first media item as thumbnail", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media1 = await seedMediaItem(testDb, post.id, {
        filePath: "/downloads/1.jpg",
      });
      const media2 = await seedMediaItem(testDb, post.id, {
        filePath: "/downloads/2.jpg",
      });

      const { items } = await getMediaItems();
      expect(items.length).toBe(1); // Grouped by post, so 1 group
      expect(items[0].groupCount).toBe(2);
      expect(items[0].item.id).toBe(media1.id); // Thumbnail is first media item
      const itemIds = items[0].groupItems.map((gi) => gi.item.id);
      expect(itemIds).toEqual([media1.id, media2.id]); // Group items ordered ascending
    });

    it("should handle cursor pagination correctly", async () => {
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const _media1 = await seedMediaItem(testDb, post.id, {
        createdAt: new Date("2026-01-01"),
      });
      const _media2 = await seedMediaItem(testDb, post.id, {
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
});

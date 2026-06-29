import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../../../../tests/unit/helpers/db";
import {
  seedMediaItem,
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

// Mock settings module
vi.mock("@/lib/settings", () => {
  return {
    getAppSettings: vi.fn().mockResolvedValue({
      computeStorageStatistics: true,
    }),
  };
});

// Mock node:fs to intercept downloads checks but fallback to actual fs for migrations
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    // biome-ignore lint/suspicious/noExplicitAny: mock path can be any
    existsSync: (path: any) => {
      if (typeof path === "string" && path.includes("downloads")) {
        return true;
      }
      return actual.existsSync(path);
    },
  };
});

// Mock node:fs/promises to return mocked sizes for downloads folder
vi.mock("node:fs/promises", async () => {
  const actual =
    await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises",
    );
  // biome-ignore lint/suspicious/noExplicitAny: mock options can be any
  const readdirMock = async (dir: string, options: any) => {
    if (dir.includes("downloads")) {
      return [
        { name: "file1.jpg", isFile: () => true, isDirectory: () => false },
        { name: "file2.jpg", isFile: () => true, isDirectory: () => false },
        // biome-ignore lint/suspicious/noExplicitAny: mock output is coerced
      ] as any;
    }
    return actual.readdir(dir, options);
  };
  const statMock = async (path: string) => {
    if (path.includes("downloads")) {
      // biome-ignore lint/suspicious/noExplicitAny: mock return stat is any
      return { size: 512 } as any;
    }
    return actual.stat(path);
  };
  return {
    ...actual,
    default: {
      ...actual,
      readdir: readdirMock,
      stat: statMock,
    },
  };
});

const testDb = testDbHelper.db;
activeDb = testDb;

import { getAppSettings } from "@/lib/settings";
import { postTags } from "../schema";
import {
  getHistory,
  getStatistics,
  getTopExtractors,
  getTopTags,
  getTopUsers,
  incrementStatistics,
  recomputeStatistics,
  recordHistorySnapshot,
} from "./statistics";

describe("Statistics Repository", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
    vi.mocked(getAppSettings).mockResolvedValue({
      computeStorageStatistics: true,
    } as unknown as Parameters<typeof vi.mocked<() => Promise<unknown>>>[0]);
  });

  describe("recomputeStatistics", () => {
    it("should compute aggregates and calculate storage size from directory", async () => {
      const source = await seedSource(testDb, { extractorType: "twitter" });
      const post = await seedPost(testDb, source.id, {
        extractorType: "twitter",
      });
      await seedMediaItem(testDb, post.id);
      await seedTag(testDb, "cool");
      await seedTwitterUser(testDb, "test_user_id");

      const stats = await recomputeStatistics();
      expect(stats.totalPosts).toBe(1);
      expect(stats.totalMediaItems).toBe(1);
      expect(stats.totalTags).toBe(1);
      expect(stats.totalUsers).toBe(1);
      expect(stats.totalExtractors).toBe(1);
      expect(stats.storageBytes).toBe(1024); // mock return value 1024 bytes (2 files * 512 bytes)
    });

    it("should fallback to previous storage size if computeStorageStatistics is false", async () => {
      vi.mocked(getAppSettings).mockResolvedValue({
        computeStorageStatistics: false,
      } as unknown as Parameters<typeof vi.mocked<() => Promise<unknown>>>[0]);

      // Pre-seed some statistics with a custom storage size
      await testDb
        .insert(testDbHelper.db.query.libraryStatistics.table)
        .values({
          totalPosts: 0,
          totalMediaItems: 0,
          totalTags: 0,
          totalUsers: 0,
          totalExtractors: 0,
          storageBytes: 9999,
          updatedAt: Date.now(),
        });

      const stats = await recomputeStatistics();
      expect(stats.storageBytes).toBe(9999);
    });
  });

  describe("incrementStatistics", () => {
    it("should atomically adjust counters", async () => {
      // First recompute to initialize the stats row
      await recomputeStatistics();

      await incrementStatistics({
        totalPosts: 5,
        totalMediaItems: 10,
        storageBytes: 2048,
      });

      const stats = await getStatistics();
      expect(stats.totalPosts).toBe(5);
      expect(stats.totalMediaItems).toBe(10);
      expect(stats.storageBytes).toBe(3072);
    });
  });

  describe("History Snapshotting", () => {
    it("should record and query history snapshots", async () => {
      const source = await seedSource(testDb);
      const post1 = await seedPost(testDb, source.id, {
        createdAt: new Date("2026-06-01T12:00:00Z"),
      });
      const post2 = await seedPost(testDb, source.id, {
        createdAt: new Date("2026-06-02T12:00:00Z"),
      });

      await seedMediaItem(testDb, post1.id);
      await seedMediaItem(testDb, post2.id);

      await recomputeStatistics();
      await recordHistorySnapshot("import");

      const history = await getHistory("import", "day");
      expect(history.length).toBe(2);
      expect(history[0].date).toBe("2026-06-01");
      expect(history[0].totalPosts).toBe(1);
      expect(history[1].date).toBe("2026-06-02");
      expect(history[1].totalPosts).toBe(2);
    });
  });

  describe("Ranked list selectors", () => {
    it("should query top tags, users, and extractors", async () => {
      const source = await seedSource(testDb, { extractorType: "twitter" });
      const post = await seedPost(testDb, source.id, {
        extractorType: "twitter",
        userId: "tw_user_id",
      });
      const _media = await seedMediaItem(testDb, post.id, {
        mediaType: "image",
        filePath: "media1.jpg",
      });
      const tag = await seedTag(testDb, "cool");
      await seedTwitterUser(testDb, "tw_user_id", { name: "User name" });

      await testDb.insert(postTags).values({ postId: post.id, tagId: tag.id });

      // Get top tags
      const topTags = await getTopTags("count", "desc", 5);
      expect(topTags.length).toBe(1);
      expect(topTags[0].name).toBe("cool");
      expect(topTags[0].backgroundImage).toBe("media1.jpg");

      // Get top users
      const topUsers = await getTopUsers("count", "desc", 5);
      expect(topUsers.length).toBe(1);
      expect(topUsers[0].name).toBe("User name");

      // Get top extractors
      const topExtractors = await getTopExtractors("count", "desc", 5);
      expect(topExtractors.length).toBe(1);
      expect(topExtractors[0].name).toBe("twitter");
    });
  });
});

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { posts, tags } from "@/lib/db/schema";
import { GelbooruProcessor } from "@/lib/library/processors/gelbooru";
import type { ProcessorContext, ProcessTask } from "@/lib/library/types";
import { setupTestDb } from "../helpers/db";
import { seedBuiltinCategories, seedSource } from "../helpers/seed";

const testDbHelper = setupTestDb();
let activeDb: ReturnType<typeof setupTestDb>["db"];

vi.mock("@/lib/db", () => ({
  get db() {
    return activeDb;
  },
  initDb: vi.fn(),
}));

activeDb = testDbHelper.db;

describe("Gelbooru Processor Tag Category Import", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  it("should process Gelbooru metadata and import tags with correct category assignments", async () => {
    await seedBuiltinCategories(activeDb);

    const source = await seedSource(activeDb);

    // Load categories
    const categories = await activeDb.query.tagCategories.findMany();
    const categoryMap = new Map<string, number>();
    for (const cat of categories) {
      categoryMap.set(cat.name, cat.id);
    }

    const context: ProcessorContext = {
      tx: activeDb as any,
      existingTwitterUsers: new Set(),
      existingPixivUsers: new Set(),
      existingTags: new Map(),
      existingPosts: new Map(),
      categoryMap,
      userAvatars: new Map(),
      internalSourceId: source.id,
    };

    const task: ProcessTask = {
      fsPath: "/downloads/gelbooru/123.jpg",
      dbFilePath: "/downloads/gelbooru/123.jpg",
      jsonPath: "/downloads/gelbooru/123.json",
      defaultType: "image",
      sourceId: source.id,
    };

    const meta = {
      id: "123",
      created_at: "2026-06-30T10:00:00Z",
      source: "https://gelbooru.com",
      tags: "character:hatsune_miku artist:wlop copyright:vocaloid meta:highres general_tag",
    };

    const processor = new GelbooruProcessor();
    const postId = await processor.process(meta, task, context);
    expect(postId).not.toBeNull();

    // Verify post was created
    const postRecord = await activeDb.query.posts.findFirst({
      where: eq(posts.id, postId!),
    });
    expect(postRecord).not.toBeUndefined();

    // Verify tags were created with correct categories
    const dbTags = await activeDb.query.tags.findMany({
      with: { category: true },
    });

    expect(dbTags.length).toBe(5);

    const miku = dbTags.find((t) => t.name === "hatsune_miku");
    expect(miku).not.toBeUndefined();
    expect(miku?.category?.name).toBe("character");

    const wlop = dbTags.find((t) => t.name === "wlop");
    expect(wlop?.category?.name).toBe("artist");

    const vocaloid = dbTags.find((t) => t.name === "vocaloid");
    expect(vocaloid?.category?.name).toBe("copyright");

    const highres = dbTags.find((t) => t.name === "highres");
    expect(highres?.category?.name).toBe("meta");

    const general = dbTags.find((t) => t.name === "general_tag");
    expect(general?.category).toBeNull();
  });
});

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { posts, tags } from "@/lib/db/schema";
import { EHentaiProcessor } from "@/lib/library/processors/ehentai";
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

describe("EHentai Processor Tag Category Import", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  it("should process EHentai metadata and import tags with correct category assignments", async () => {
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
      fsPath: "/downloads/ehentai/123456/001.jpg",
      dbFilePath: "/downloads/ehentai/123456/001.jpg",
      jsonPath: "/downloads/ehentai/123456/123456.json",
      defaultType: "image",
      sourceId: source.id,
    };

    const meta = {
      gid: 123456,
      token: "abcde",
      title: "Test Gallery",
      eh_category: "Non-H",
      uploader: "uploader_user",
      date: "2026-06-30T10:00:00Z",
      tags: [
        "artist:some_artist",
        "character:some_character",
        "cosplayer:some_cosplayer",
        "group:some_group",
        "circle:some_circle",
        "parody:some_parody",
        "language:english",
        "reclass:manga",
        "female:sole_female",
        "male:sole_male",
        "some_general_tag",
      ],
    };

    const processor = new EHentaiProcessor("ehentai");
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

    expect(dbTags.length).toBe(11);

    const artist = dbTags.find((t) => t.name === "some_artist");
    expect(artist?.category?.name).toBe("artist");

    const char = dbTags.find((t) => t.name === "some_character");
    expect(char?.category?.name).toBe("character");

    const cosplayer = dbTags.find((t) => t.name === "some_cosplayer");
    expect(cosplayer?.category?.name).toBe("character");

    const group = dbTags.find((t) => t.name === "some_group");
    expect(group?.category?.name).toBe("copyright");

    const circle = dbTags.find((t) => t.name === "some_circle");
    expect(circle?.category?.name).toBe("copyright");

    const parody = dbTags.find((t) => t.name === "some_parody");
    expect(parody?.category?.name).toBe("copyright");

    const lang = dbTags.find((t) => t.name === "english");
    expect(lang?.category?.name).toBe("meta");

    const reclass = dbTags.find((t) => t.name === "manga");
    expect(reclass?.category?.name).toBe("meta");

    const female = dbTags.find((t) => t.name === "sole_female");
    expect(female?.category).toBeNull();

    const male = dbTags.find((t) => t.name === "sole_male");
    expect(male?.category).toBeNull();

    const general = dbTags.find((t) => t.name === "some_general_tag");
    expect(general?.category).toBeNull();
  });
});

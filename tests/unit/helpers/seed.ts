import { eq } from "drizzle-orm";
import {
  gallerydlExtractorTypes,
  mediaItems,
  pixivUsers,
  playlists,
  posts,
  sources,
  tagCategories,
  tags,
  twitterUsers,
} from "@/lib/db/schema";
import type { setupTestDb } from "./db";

type TestDb = ReturnType<typeof setupTestDb>["db"];

export async function seedExtractorType(db: TestDb, type: string) {
  await db
    .insert(gallerydlExtractorTypes)
    .values({ id: type, description: `${type} description` })
    .onConflictDoNothing();
}

export async function seedSource(
  db: TestDb,
  overrides?: Partial<typeof sources.$inferInsert>,
) {
  const type = overrides?.extractorType || "twitter";
  await seedExtractorType(db, type);

  const values = {
    url: "https://twitter.com/test_user",
    extractorType: type,
    name: "Test Source",
    ...overrides,
  };

  const results = await db.insert(sources).values(values).returning();
  return results[0];
}

export async function seedPost(
  db: TestDb,
  internalSourceId: number,
  overrides?: Partial<typeof posts.$inferInsert>,
) {
  const values = {
    extractorType: "twitter",
    jsonSourceId: `post_${Date.now()}_${Math.random()}`,
    internalSourceId,
    userId: "test_user_id",
    date: new Date().toISOString(),
    title: "Test Post",
    content: "This is a test post content.",
    url: "https://twitter.com/test_user/status/123",
    metadataPath: "/tmp/metadata.json",
    ...overrides,
  };

  const results = await db.insert(posts).values(values).returning();
  return results[0];
}

export async function seedMediaItem(
  db: TestDb,
  postId: number | null,
  overrides?: Partial<typeof mediaItems.$inferInsert>,
) {
  const values = {
    filePath: `/tmp/media_${Date.now()}_${Math.random()}.jpg`,
    mediaType: "image" as const,
    capturedAt: new Date(),
    width: 800,
    height: 600,
    postId,
    ...overrides,
  };

  const results = await db.insert(mediaItems).values(values).returning();
  return results[0];
}

export async function seedTagCategory(
  db: TestDb,
  name: string,
  overrides?: Partial<typeof tagCategories.$inferInsert>,
) {
  const values = {
    name,
    colorHue: 0,
    colorSaturation: 0,
    colorLightness: 60,
    isBuiltin: false,
    ...overrides,
  };

  const results = await db
    .insert(tagCategories)
    .values(values)
    .onConflictDoNothing()
    .returning();

  if (results.length > 0) return results[0];

  const existing = await db
    .select()
    .from(tagCategories)
    .where(eq(tagCategories.name, name))
    .limit(1);
  return existing[0];
}

export async function seedBuiltinCategories(db: TestDb) {
  const builtinCategories = [
    {
      name: "character",
      colorHue: 140,
      colorSaturation: 60,
      colorLightness: 50,
      isBuiltin: true,
    },
    {
      name: "artist",
      colorHue: 0,
      colorSaturation: 70,
      colorLightness: 55,
      isBuiltin: true,
    },
    {
      name: "copyright",
      colorHue: 270,
      colorSaturation: 60,
      colorLightness: 55,
      isBuiltin: true,
    },
    {
      name: "meta",
      colorHue: 50,
      colorSaturation: 70,
      colorLightness: 55,
      isBuiltin: true,
    },
  ];

  for (const cat of builtinCategories) {
    await db.insert(tagCategories).values(cat).onConflictDoNothing();
  }
}

export async function seedTag(
  db: TestDb,
  name: string,
  categoryId?: number | null,
) {
  const results = await db
    .insert(tags)
    .values({ name, categoryId })
    .onConflictDoNothing()
    .returning();

  if (results.length > 0) return results[0];

  const existing = await db
    .select()
    .from(tags)
    .where(eq(tags.name, name))
    .limit(1);
  return existing[0];
}

export async function seedPlaylist(
  db: TestDb,
  overrides?: Partial<typeof playlists.$inferInsert>,
) {
  const values = {
    name: "Test Playlist",
    description: "A test playlist",
    thumbnail: "/tmp/thumb.jpg",
    ...overrides,
  };

  const results = await db.insert(playlists).values(values).returning();
  return results[0];
}

export async function seedTwitterUser(
  db: TestDb,
  id: string,
  overrides?: Partial<typeof twitterUsers.$inferInsert>,
) {
  const values = {
    id,
    name: "Twitter Test User",
    nick: "twitter_test",
    profileImage: "https://twitter.com/profile.jpg",
    ...overrides,
  };

  const results = await db.insert(twitterUsers).values(values).returning();
  return results[0];
}

export async function seedPixivUser(
  db: TestDb,
  id: string,
  overrides?: Partial<typeof pixivUsers.$inferInsert>,
) {
  const values = {
    id,
    name: "Pixiv Test User",
    account: "pixiv_test",
    profileImage: "https://pixiv.net/profile.jpg",
    ...overrides,
  };

  const results = await db.insert(pixivUsers).values(values).returning();
  return results[0];
}

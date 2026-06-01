import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { paths } from "@/lib/config";
import { db } from "@/lib/db";
import {
  libraryStatistics,
  mediaItems,
  pixivUsers,
  posts,
  postTags,
  statisticsHistory,
  tags,
  twitterUsers,
} from "@/lib/db/schema";
import { getAppSettings } from "@/lib/settings";
import type {
  HistoryDateType,
  HistoryGranularity,
  LibraryStatistics,
  StatisticsHistoryPoint,
  TopExtractorCard,
  TopTagCard,
  TopUserCard,
} from "@/types/statistics";

/**
 * Recursively calculates the total size of a directory in bytes.
 */
async function getDirectorySize(dir: string): Promise<number> {
  let size = 0;
  if (!existsSync(dir)) return 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        size += stat.size;
      }
    }
  } catch (error) {
    console.error(
      `[Statistics] Error reading directory size for ${dir}:`,
      error,
    );
  }
  return size;
}

/**
 * Performs a full recomputation of library statistics.
 */
export async function recomputeStatistics(): Promise<LibraryStatistics> {
  const postsRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts);
  const mediaRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(mediaItems);
  const tagsRes = await db.select({ count: sql<number>`count(*)` }).from(tags);
  const twitterUsersRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(twitterUsers);
  const pixivUsersRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(pixivUsers);
  const extractorsRes = await db
    .select({ count: sql<number>`count(distinct ${posts.extractorType})` })
    .from(posts);

  const totalPosts = postsRes[0]?.count ?? 0;
  const totalMediaItems = mediaRes[0]?.count ?? 0;
  const totalTags = tagsRes[0]?.count ?? 0;
  const totalUsers =
    (twitterUsersRes[0]?.count ?? 0) + (pixivUsersRes[0]?.count ?? 0);
  const totalExtractors = extractorsRes[0]?.count ?? 0;

  let storageBytes = 0;
  const settings = await getAppSettings();
  if (settings.computeStorageStatistics) {
    storageBytes = await getDirectorySize(paths.downloads);
  } else {
    const prev = await db
      .select({ storageBytes: libraryStatistics.storageBytes })
      .from(libraryStatistics)
      .limit(1);
    storageBytes = prev[0]?.storageBytes ?? 0;
  }

  const updatedAt = Date.now();

  const stats = {
    totalPosts,
    totalMediaItems,
    totalTags,
    totalUsers,
    totalExtractors,
    storageBytes,
    updatedAt,
  };

  const existing = await db.select().from(libraryStatistics).limit(1);
  if (existing.length > 0) {
    await db
      .update(libraryStatistics)
      .set(stats)
      .where(eq(libraryStatistics.id, existing[0].id));
  } else {
    await db.insert(libraryStatistics).values(stats);
  }

  return { ...stats } as LibraryStatistics;
}

/**
 * Atomically increments/decrements current counters.
 */
export async function incrementStatistics(
  delta: Partial<Omit<LibraryStatistics, "updatedAt">>,
) {
  const existing = await db.select().from(libraryStatistics).limit(1);
  if (existing.length === 0) {
    await recomputeStatistics();
    return;
  }

  const current = existing[0];
  const totalPosts = Math.max(0, current.totalPosts + (delta.totalPosts ?? 0));
  const totalMediaItems = Math.max(
    0,
    current.totalMediaItems + (delta.totalMediaItems ?? 0),
  );
  const totalTags = Math.max(0, current.totalTags + (delta.totalTags ?? 0));
  const totalUsers = Math.max(0, current.totalUsers + (delta.totalUsers ?? 0));
  const totalExtractors = Math.max(
    0,
    current.totalExtractors + (delta.totalExtractors ?? 0),
  );
  const storageBytes = Math.max(
    0,
    current.storageBytes + (delta.storageBytes ?? 0),
  );
  const updatedAt = Date.now();

  await db
    .update(libraryStatistics)
    .set({
      totalPosts,
      totalMediaItems,
      totalTags,
      totalUsers,
      totalExtractors,
      storageBytes,
      updatedAt,
    })
    .where(eq(libraryStatistics.id, current.id));
}

/**
 * Returns current snapshot of statistics. Recomputes if missing.
 */
export async function getStatistics(): Promise<LibraryStatistics> {
  const existing = await db.select().from(libraryStatistics).limit(1);
  if (existing.length > 0) {
    return existing[0] as LibraryStatistics;
  }
  return await recomputeStatistics();
}

/**
 * Groups posts by date, computes running cumulative totals, and upserts them.
 */
export async function recordHistorySnapshot(dateType: HistoryDateType) {
  const stats = await getStatistics();
  if (stats.totalPosts === 0) return;

  let postsByDate: { day: string; count: number }[] = [];

  if (dateType === "import") {
    const dayExpr = sql<string>`date(${posts.createdAt}, 'unixepoch')`;
    postsByDate = await db
      .select({
        day: dayExpr,
        count: sql<number>`count(*)`,
      })
      .from(posts)
      .where(sql`${posts.createdAt} is not null`)
      .groupBy(dayExpr)
      .orderBy(dayExpr);
  } else {
    const dayExpr = sql<string>`substr(${posts.date}, 1, 10)`;
    postsByDate = await db
      .select({
        day: dayExpr,
        count: sql<number>`count(*)`,
      })
      .from(posts)
      .where(sql`${posts.date} is not null and ${posts.date} != ''`)
      .groupBy(dayExpr)
      .orderBy(dayExpr);
  }

  let cumulativePosts = 0;
  const historyPoints: any[] = [];

  for (const row of postsByDate) {
    if (!row.day) continue;
    cumulativePosts += row.count;

    const ratio = stats.totalPosts > 0 ? cumulativePosts / stats.totalPosts : 0;
    const cumulativeMedia = Math.round(ratio * stats.totalMediaItems);
    const cumulativeTags = Math.round(ratio * stats.totalTags);
    const cumulativeUsers = Math.round(ratio * stats.totalUsers);
    const cumulativeExtractors = Math.round(ratio * stats.totalExtractors);
    const cumulativeStorage = Math.round(ratio * stats.storageBytes);

    historyPoints.push({
      date: row.day,
      dateType,
      totalPosts: cumulativePosts,
      totalMediaItems: cumulativeMedia,
      totalTags: cumulativeTags,
      totalUsers: cumulativeUsers,
      totalExtractors: cumulativeExtractors,
      storageBytes: cumulativeStorage,
    });
  }

  if (historyPoints.length > 0) {
    for (let i = 0; i < historyPoints.length; i += 100) {
      const chunk = historyPoints.slice(i, i + 100);
      await db
        .insert(statisticsHistory)
        .values(chunk)
        .onConflictDoUpdate({
          target: [statisticsHistory.date, statisticsHistory.dateType],
          set: {
            totalPosts: sql`excluded.total_posts`,
            totalMediaItems: sql`excluded.total_media_items`,
            totalTags: sql`excluded.total_tags`,
            totalUsers: sql`excluded.total_users`,
            totalExtractors: sql`excluded.total_extractors`,
            storageBytes: sql`excluded.storage_bytes`,
          },
        });
    }
  }
}

/**
 * Returns bucketed history data.
 */
export async function getHistory(
  dateType: HistoryDateType,
  granularity: HistoryGranularity,
  startDate?: string,
  endDate?: string,
): Promise<StatisticsHistoryPoint[]> {
  // 1. Get current totals to distribute proportionally
  const stats = await getStatistics();
  if (stats.totalPosts === 0) return [];

  // 2. Query posts count grouped by day directly from the posts table
  let postsByDate: { day: string; count: number }[] = [];

  if (dateType === "import") {
    const dayExpr = sql<string>`date(${posts.createdAt}, 'unixepoch')`;
    postsByDate = await db
      .select({
        day: dayExpr,
        count: sql<number>`count(*)`,
      })
      .from(posts)
      .where(sql`${posts.createdAt} is not null`)
      .groupBy(dayExpr)
      .orderBy(dayExpr);
  } else {
    const dayExpr = sql<string>`substr(${posts.date}, 1, 10)`;
    postsByDate = await db
      .select({
        day: dayExpr,
        count: sql<number>`count(*)`,
      })
      .from(posts)
      .where(sql`${posts.date} is not null and ${posts.date} != ''`)
      .groupBy(dayExpr)
      .orderBy(dayExpr);
  }

  // 3. Compute cumulative running totals dynamically
  let cumulativePosts = 0;
  let historyPoints: StatisticsHistoryPoint[] = [];

  for (const row of postsByDate) {
    if (!row.day) continue;
    cumulativePosts += row.count;

    const ratio = stats.totalPosts > 0 ? cumulativePosts / stats.totalPosts : 0;
    const cumulativeMedia = Math.round(ratio * stats.totalMediaItems);
    const cumulativeTags = Math.round(ratio * stats.totalTags);
    const cumulativeUsers = Math.round(ratio * stats.totalUsers);
    const cumulativeExtractors = Math.round(ratio * stats.totalExtractors);
    const cumulativeStorage = Math.round(ratio * stats.storageBytes);

    historyPoints.push({
      date: row.day,
      totalPosts: cumulativePosts,
      totalMediaItems: cumulativeMedia,
      totalTags: cumulativeTags,
      totalUsers: cumulativeUsers,
      totalExtractors: cumulativeExtractors,
      storageBytes: cumulativeStorage,
    });
  }

  // 4. Apply range filters
  if (startDate) {
    historyPoints = historyPoints.filter((r) => r.date >= startDate);
  }
  if (endDate) {
    historyPoints = historyPoints.filter((r) => r.date <= endDate);
  }

  // 5. Apply granularity bucketing
  if (granularity === "day") {
    return historyPoints;
  }

  const buckets: Record<string, StatisticsHistoryPoint> = {};
  for (const point of historyPoints) {
    let key = point.date;
    if (granularity === "month") {
      key = point.date.substring(0, 7) + "-01";
    } else if (granularity === "year") {
      key = point.date.substring(0, 4) + "-01-01";
    } else if (granularity === "week") {
      key = getStartOfWeek(point.date);
    }
    buckets[key] = point;
  }

  return Object.keys(buckets)
    .sort()
    .map((key) => ({
      ...buckets[key],
      date: key,
    }));
}

function getStartOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

/**
 * Utility helper to fetch top users/avatars details by their usernames/accounts
 */
async function fetchUserMinimalDetails(userIds: string[]) {
  if (userIds.length === 0) return {};

  const twitterDetails = await db
    .select({
      id: twitterUsers.id,
      name: twitterUsers.name,
      avatar: twitterUsers.profileImage,
    })
    .from(twitterUsers)
    .where(inArray(twitterUsers.id, userIds));

  const pixivDetails = await db
    .select({
      id: pixivUsers.id,
      name: pixivUsers.name,
      avatar: pixivUsers.profileImage,
    })
    .from(pixivUsers)
    .where(inArray(pixivUsers.id, userIds));

  const userMap: Record<string, { name: string; avatar?: string }> = {};
  for (const u of twitterDetails) {
    userMap[u.id] = {
      name: u.name || u.id,
      avatar: u.avatar ? `/api/avatar/twitter/${u.id}` : undefined,
    };
  }
  for (const u of pixivDetails) {
    userMap[u.id] = {
      name: u.name || u.id,
      avatar: u.avatar ? `/api/avatar/pixiv/${u.id}` : undefined,
    };
  }
  return userMap;
}

/**
 * Top N tags.
 */
export async function getTopTags(
  sortBy: "count" | "latest-added" | "latest-used",
  sortOrder: "asc" | "desc",
  limit: number,
): Promise<TopTagCard[]> {
  let orderSql = desc(sql`count(*)`);
  if (sortBy === "latest-added") {
    orderSql =
      sortOrder === "asc"
        ? asc(sql`max(${posts.createdAt})`)
        : desc(sql`max(${posts.createdAt})`);
  } else if (sortBy === "latest-used") {
    orderSql =
      sortOrder === "asc"
        ? asc(sql`max(${posts.date})`)
        : desc(sql`max(${posts.date})`);
  } else {
    orderSql = sortOrder === "asc" ? asc(sql`count(*)`) : desc(sql`count(*)`);
  }

  const topTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      value: sql<number>`count(${postTags.postId})`,
    })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .groupBy(tags.id)
    .orderBy(orderSql)
    .limit(limit);

  const cards: TopTagCard[] = [];

  for (const tag of topTags) {
    // 1. Top Users for this tag
    const topUsersRes = await db
      .select({
        id: posts.userId,
        postCount: sql<number>`count(*)`,
      })
      .from(posts)
      .innerJoin(postTags, eq(postTags.postId, posts.id))
      .where(
        and(
          eq(postTags.tagId, tag.id),
          sql`${posts.userId} is not null and ${posts.userId} != ''`,
        ),
      )
      .groupBy(posts.userId)
      .orderBy(desc(sql`count(*)`))
      .limit(3);

    const userIds = topUsersRes.map((u) => u.id!).filter(Boolean);
    const userDetails = await fetchUserMinimalDetails(userIds);

    const topUsers = topUsersRes.map((u) => ({
      id: u.id!,
      name: userDetails[u.id!]?.name || u.id!,
      avatar: userDetails[u.id!]?.avatar,
      postCount: u.postCount,
    }));

    // 2. Top Extractors for this tag
    const topExtractors = await db
      .select({
        name: posts.extractorType,
        postCount: sql<number>`count(*)`,
      })
      .from(posts)
      .innerJoin(postTags, eq(postTags.postId, posts.id))
      .where(eq(postTags.tagId, tag.id))
      .groupBy(posts.extractorType)
      .orderBy(desc(sql`count(*)`))
      .limit(3);

    // 3. Background image from first media
    const bgRes = await db
      .select({
        filePath: mediaItems.filePath,
      })
      .from(mediaItems)
      .innerJoin(posts, eq(posts.id, mediaItems.postId))
      .innerJoin(postTags, eq(postTags.postId, posts.id))
      .where(eq(postTags.tagId, tag.id))
      .limit(1);

    cards.push({
      id: tag.id,
      name: tag.name,
      value: tag.value,
      topUsers,
      topExtractors: topExtractors.map((e) => ({
        name: e.name,
        postCount: e.postCount,
      })),
      backgroundImage: bgRes[0]?.filePath || undefined,
    });
  }

  return cards;
}

/**
 * Top N users.
 */
export async function getTopUsers(
  sortBy: "count" | "latest-added" | "latest-used",
  sortOrder: "asc" | "desc",
  limit: number,
): Promise<TopUserCard[]> {
  let orderSql = desc(sql`count(*)`);
  if (sortBy === "latest-added") {
    orderSql =
      sortOrder === "asc"
        ? asc(sql`max(${posts.createdAt})`)
        : desc(sql`max(${posts.createdAt})`);
  } else if (sortBy === "latest-used") {
    orderSql =
      sortOrder === "asc"
        ? asc(sql`max(${posts.date})`)
        : desc(sql`max(${posts.date})`);
  } else {
    orderSql = sortOrder === "asc" ? asc(sql`count(*)`) : desc(sql`count(*)`);
  }

  const topUsers = await db
    .select({
      userId: posts.userId,
      value: sql<number>`count(*)`,
    })
    .from(posts)
    .where(sql`${posts.userId} is not null and ${posts.userId} != ''`)
    .groupBy(posts.userId)
    .orderBy(orderSql)
    .limit(limit);

  const cards: TopUserCard[] = [];

  const userIds = topUsers.map((u) => u.userId!).filter(Boolean);
  const userDetails = await fetchUserMinimalDetails(userIds);

  for (const user of topUsers) {
    if (!user.userId) continue;

    // 1. Top Tags for this user
    const topTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        postCount: sql<number>`count(*)`,
      })
      .from(tags)
      .innerJoin(postTags, eq(postTags.tagId, tags.id))
      .innerJoin(posts, eq(posts.id, postTags.postId))
      .where(eq(posts.userId, user.userId))
      .groupBy(tags.id)
      .orderBy(desc(sql`count(*)`))
      .limit(3);

    // 2. Top Extractors for this user
    const topExtractors = await db
      .select({
        name: posts.extractorType,
        postCount: sql<number>`count(*)`,
      })
      .from(posts)
      .where(eq(posts.userId, user.userId))
      .groupBy(posts.extractorType)
      .orderBy(desc(sql`count(*)`))
      .limit(3);

    // 3. Background image from first media
    const bgRes = await db
      .select({
        filePath: mediaItems.filePath,
      })
      .from(mediaItems)
      .innerJoin(posts, eq(posts.id, mediaItems.postId))
      .where(eq(posts.userId, user.userId))
      .limit(1);

    cards.push({
      id: user.userId,
      name: userDetails[user.userId]?.name || user.userId,
      avatar: userDetails[user.userId]?.avatar,
      value: user.value,
      topTags: topTags.map((t) => ({
        id: t.id,
        name: t.name,
        postCount: t.postCount,
      })),
      topExtractors: topExtractors.map((e) => ({
        name: e.name,
        postCount: e.postCount,
      })),
      backgroundImage: bgRes[0]?.filePath || undefined,
    });
  }

  return cards;
}

/**
 * Top N extractors.
 */
export async function getTopExtractors(
  sortBy: "count" | "latest-added" | "latest-used",
  sortOrder: "asc" | "desc",
  limit: number,
): Promise<TopExtractorCard[]> {
  let orderSql = desc(sql`count(*)`);
  if (sortBy === "latest-added") {
    orderSql =
      sortOrder === "asc"
        ? asc(sql`max(${posts.createdAt})`)
        : desc(sql`max(${posts.createdAt})`);
  } else if (sortBy === "latest-used") {
    orderSql =
      sortOrder === "asc"
        ? asc(sql`max(${posts.date})`)
        : desc(sql`max(${posts.date})`);
  } else {
    orderSql = sortOrder === "asc" ? asc(sql`count(*)`) : desc(sql`count(*)`);
  }

  const topExtractors = await db
    .select({
      name: posts.extractorType,
      value: sql<number>`count(*)`,
    })
    .from(posts)
    .where(sql`${posts.extractorType} is not null`)
    .groupBy(posts.extractorType)
    .orderBy(orderSql)
    .limit(limit);

  const cards: TopExtractorCard[] = [];

  for (const ext of topExtractors) {
    if (!ext.name) continue;

    // 1. Top Tags for this extractor
    const topTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        postCount: sql<number>`count(*)`,
      })
      .from(tags)
      .innerJoin(postTags, eq(postTags.tagId, tags.id))
      .innerJoin(posts, eq(posts.id, postTags.postId))
      .where(eq(posts.extractorType, ext.name))
      .groupBy(tags.id)
      .orderBy(desc(sql`count(*)`))
      .limit(3);

    // 2. Top Users for this extractor
    const topUsersRes = await db
      .select({
        id: posts.userId,
        postCount: sql<number>`count(*)`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.extractorType, ext.name),
          sql`${posts.userId} is not null and ${posts.userId} != ''`,
        ),
      )
      .groupBy(posts.userId)
      .orderBy(desc(sql`count(*)`))
      .limit(3);

    const userIds = topUsersRes.map((u) => u.id!).filter(Boolean);
    const userDetails = await fetchUserMinimalDetails(userIds);

    const topUsers = topUsersRes.map((u) => ({
      id: u.id!,
      name: userDetails[u.id!]?.name || u.id!,
      avatar: userDetails[u.id!]?.avatar,
      postCount: u.postCount,
    }));

    // 3. Background image from first media
    const bgRes = await db
      .select({
        filePath: mediaItems.filePath,
      })
      .from(mediaItems)
      .innerJoin(posts, eq(posts.id, mediaItems.postId))
      .where(eq(posts.extractorType, ext.name))
      .limit(1);

    cards.push({
      name: ext.name,
      value: ext.value,
      topTags: topTags.map((t) => ({
        id: t.id,
        name: t.name,
        postCount: t.postCount,
      })),
      topUsers,
      backgroundImage: bgRes[0]?.filePath || undefined,
    });
  }

  return cards;
}

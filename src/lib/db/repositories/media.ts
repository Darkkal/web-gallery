import fs from "node:fs/promises";
import path from "node:path";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { paths } from "@/lib/config";
import { db } from "@/lib/db";
import { incrementStatistics } from "@/lib/db/repositories/statistics";
import {
  mediaItems,
  pixivUsers,
  playlistItems,
  postDetailsGelbooruV02,
  postDetailsPixiv,
  postDetailsTwitter,
  posts,
  sources,
  twitterUsers,
} from "@/lib/db/schema";
import { parseSearchQuery } from "@/lib/utils/search-parser";

export async function getMediaItems(filters?: {
  search?: string;
  sortBy?: string;
  limit?: number;
  cursor?: string;
  playlistId?: number;
}) {
  const limit = filters?.limit ?? 50;
  const search = filters?.search ?? "";
  const sortBy = filters?.sortBy ?? "created-desc";

  const { cleanQuery, sourceFilter } = parseSearchQuery(search);
  const searchLower = cleanQuery.toLowerCase();

  const whereConditions: SQL[] = [ne(mediaItems.mediaType, "text")];

  if (sourceFilter) {
    whereConditions.push(eq(posts.extractorType, sourceFilter));
  }

  if (filters?.playlistId) {
    const playlistItemSubquery = db
      .select({ mediaItemId: playlistItems.mediaItemId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, filters.playlistId));
    whereConditions.push(inArray(mediaItems.id, playlistItemSubquery));
  }

  const searchSubquery = searchLower
    ? db
        .select({
          search_id: sql<number>`rowid`.as("search_id"),
          rank: sql<number>`bm25(posts_fts, 10.0, 1.0, 5.0, 5.0, 2.0, 1.0)`.as(
            "rank",
          ),
        })
        .from(sql`posts_fts`)
        .where(sql`posts_fts MATCH ${searchLower}`)
        .as("search_subquery")
    : undefined;

  const rankCol = searchSubquery?.rank;

  let cursorSortVal: number | null = null;
  let cursorId: number | null = null;
  if (filters?.cursor) {
    try {
      const decoded = Buffer.from(filters.cursor, "base64").toString("utf-8");
      const [valStr, idStr] = decoded.split("_");
      cursorSortVal = parseFloat(valStr);
      cursorId = parseInt(idStr, 10);
    } catch {
      // Invalid cursor
    }
  }

  const orderBys: SQL[] = [];
  let cursorCond: SQL | undefined;

  let sortField: SQL;
  if (sortBy.startsWith("captured")) {
    sortField = sql`COALESCE(${mediaItems.capturedAt}, ${mediaItems.createdAt}, 0)`;
  } else {
    sortField = sql`COALESCE(${mediaItems.createdAt}, 0)`;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Drizzle aliased columns conflict with raw SQL types in query builder select shape
  let sortValOutput: any = sortField;

  if (sortBy === "relevance" && rankCol) {
    sortValOutput = rankCol;
    orderBys.push(asc(rankCol), asc(mediaItems.id));
    if (
      cursorSortVal !== null &&
      cursorId !== null &&
      !Number.isNaN(cursorId)
    ) {
      cursorCond = or(
        gt(rankCol, cursorSortVal),
        and(eq(rankCol, cursorSortVal), gt(mediaItems.id, cursorId)),
      );
    }
  } else if (sortBy.endsWith("-asc")) {
    orderBys.push(asc(sortField), asc(mediaItems.id));
    if (
      cursorSortVal !== null &&
      cursorId !== null &&
      !Number.isNaN(cursorId)
    ) {
      cursorCond = or(
        gt(sortField, cursorSortVal),
        and(eq(sortField, cursorSortVal), gt(mediaItems.id, cursorId)),
      );
    }
  } else {
    // created-desc, captured-desc
    orderBys.push(desc(sortField), desc(mediaItems.id));
    if (
      cursorSortVal !== null &&
      cursorId !== null &&
      !Number.isNaN(cursorId)
    ) {
      cursorCond = or(
        lt(sortField, cursorSortVal),
        and(eq(sortField, cursorSortVal), lt(mediaItems.id, cursorId)),
      );
    }
  }

  if (cursorCond) {
    whereConditions.push(cursorCond);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Drizzle dynamic query typing requires any for reassignment
  let resultsQuery: any = db
    .select({
      item: mediaItems,
      post: posts,
      twitter: postDetailsTwitter,
      pixiv: postDetailsPixiv,
      gelbooru: postDetailsGelbooruV02,
      user: twitterUsers,
      pixivUser: pixivUsers,
      source: sources,
      sortVal: sortValOutput, // include sortVal to easily compute the next cursor
    })
    .from(mediaItems)
    .$dynamic();

  if (searchSubquery) {
    resultsQuery = resultsQuery.innerJoin(
      searchSubquery,
      eq(mediaItems.postId, searchSubquery.search_id),
    );
  }

  const results = (await resultsQuery
    .leftJoin(posts, eq(mediaItems.postId, posts.id))
    .leftJoin(postDetailsTwitter, eq(posts.id, postDetailsTwitter.postId))
    .leftJoin(postDetailsPixiv, eq(posts.id, postDetailsPixiv.postId))
    .leftJoin(
      postDetailsGelbooruV02,
      eq(posts.id, postDetailsGelbooruV02.postId),
    )
    .leftJoin(
      twitterUsers,
      and(
        eq(posts.extractorType, "twitter"),
        eq(posts.userId, twitterUsers.id),
      ),
    )
    .leftJoin(
      pixivUsers,
      and(eq(posts.extractorType, "pixiv"), eq(posts.userId, pixivUsers.id)),
    )
    .leftJoin(sources, eq(posts.internalSourceId, sources.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(...orderBys)
    .limit(limit)) as {
    item: typeof mediaItems.$inferSelect;
    post: typeof posts.$inferSelect | null;
    twitter: typeof postDetailsTwitter.$inferSelect | null;
    pixiv: typeof postDetailsPixiv.$inferSelect | null;
    gelbooru: typeof postDetailsGelbooruV02.$inferSelect | null;
    user: typeof twitterUsers.$inferSelect | null;
    pixivUser: typeof pixivUsers.$inferSelect | null;
    source: typeof sources.$inferSelect | null;
    sortVal: unknown;
  }[];

  results.forEach((row) => {
    if (row.user?.id) {
      row.user.profileImage = `/api/avatar/twitter/${row.user.id}`;
    }
    if (row.pixivUser?.id) {
      row.pixivUser.profileImage = `/api/avatar/pixiv/${row.pixivUser.id}`;
    }
  });

  type GroupedResult = (typeof results)[number] & {
    groupItems: (typeof results)[number][];
    groupCount: number;
  };

  const groupedMap = new Map<string, GroupedResult>();

  for (const row of results) {
    const key = row.post ? `p_${row.post.id}` : `i_${row.item.id}`;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        ...row,
        groupItems: [],
        groupCount: 0,
      });
    }

    const group = groupedMap.get(key);
    if (group) {
      group.groupItems.push(row);
      group.groupCount++;
    }
  }

  let nextCursor: string | null = null;
  if (results.length === limit) {
    const lastItem = results[results.length - 1];
    const sortVal =
      lastItem.sortVal instanceof Date
        ? lastItem.sortVal.getTime()
        : typeof lastItem.sortVal === "string"
          ? Date.parse(lastItem.sortVal)
          : Number(lastItem.sortVal || 0);

    nextCursor = Buffer.from(`${sortVal}_${lastItem.item.id}`).toString(
      "base64",
    );
  }

  // Return the items minus the internal sortVal to match the previous structure as closely as possible
  const items = Array.from(groupedMap.values()).map((g) => {
    const { ...rest } = g;
    return {
      ...rest,
      groupItems: g.groupItems.map((gi) => {
        const { ...giRest } = gi;
        return giRest;
      }),
    };
  });

  return { items, nextCursor };
}

export async function deleteMediaItems(ids: number[], deleteFiles: boolean) {
  console.log(
    `[MediaRepository] Deleting ${ids.length} items (deleteFiles: ${deleteFiles})`,
  );

  if (ids.length === 0) return { success: true, count: 0 };

  let deletedStorageBytes = 0;

  if (deleteFiles) {
    const itemsToDelete = await db
      .select({ filePath: mediaItems.filePath })
      .from(mediaItems)
      .where(inArray(mediaItems.id, ids));

    const publicRoot = path.dirname(paths.downloads);

    for (const item of itemsToDelete) {
      try {
        const absolutePath = path.resolve(
          publicRoot,
          item.filePath.replace(/^\//, ""),
        );

        if (!absolutePath.startsWith(publicRoot)) {
          console.error(
            `[MediaRepository] Security Check Failed: Path ${absolutePath} is outside public dir.`,
          );
          continue;
        }

        try {
          const stat = await fs.stat(absolutePath);
          deletedStorageBytes += stat.size;
        } catch {}

        await fs.unlink(absolutePath);

        const ext = path.extname(item.filePath);
        const jsonPathStr =
          item.filePath.substring(0, item.filePath.length - ext.length) +
          ".json";
        const absoluteJsonPath = path.resolve(
          publicRoot,
          jsonPathStr.replace(/^\//, ""),
        );

        if (!absoluteJsonPath.startsWith(publicRoot)) {
          continue;
        }

        try {
          await fs.access(absoluteJsonPath);
          try {
            const jsonStat = await fs.stat(absoluteJsonPath);
            deletedStorageBytes += jsonStat.size;
          } catch {}
          await fs.unlink(absoluteJsonPath);
        } catch {
          // Ignore if missing
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[MediaRepository] Failed to delete file: ${item.filePath}`,
          msg,
        );
      }
    }
  }

  await db.delete(playlistItems).where(inArray(playlistItems.mediaItemId, ids));
  await db.delete(mediaItems).where(inArray(mediaItems.id, ids));

  try {
    await incrementStatistics({
      totalMediaItems: -ids.length,
      storageBytes: -deletedStorageBytes,
    });
  } catch (statsErr) {
    console.error(
      "[MediaRepository] Failed to update statistics on delete:",
      statsErr,
    );
  }

  return { success: true, count: ids.length };
}

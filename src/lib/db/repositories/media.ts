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
  playlists,
  postDetailsEHentai,
  postDetailsGelbooruV02,
  postDetailsPixiv,
  postDetailsTwitter,
  posts,
  sources,
  twitterUsers,
} from "@/lib/db/schema";
import { parseSearchQuery } from "@/lib/utils/search-parser";
import type { GalleryRow, PlatformDetails, PlatformUser } from "@/types/media";
import type { PlaylistPost } from "@/types/playlist";
import { expandSearchTags } from "./posts";

export function flattenToGalleryRow(row: {
  item: typeof mediaItems.$inferSelect;
  post?: typeof posts.$inferSelect | null;
  twitter?: typeof postDetailsTwitter.$inferSelect | null;
  pixiv?: typeof postDetailsPixiv.$inferSelect | null;
  gelbooru?: typeof postDetailsGelbooruV02.$inferSelect | null;
  ehentai?: typeof postDetailsEHentai.$inferSelect | null;
  user?: typeof twitterUsers.$inferSelect | null;
  pixivUser?: typeof pixivUsers.$inferSelect | null;
  source?: typeof sources.$inferSelect | null;
  platformDetails?: PlatformDetails | null;
  platformUser?: PlatformUser | null;
}): GalleryRow {
  if (row.platformDetails !== undefined) {
    return {
      item: row.item,
      post: row.post,
      platformDetails: row.platformDetails,
      platformUser: row.platformUser,
      source: row.source,
    };
  }

  let platformDetails: PlatformDetails | null = null;
  let platformUser: PlatformUser | null = null;

  const extractorType = row.post?.extractorType;

  if (extractorType === "twitter") {
    if (row.twitter) {
      platformDetails = {
        extractorType: "twitter",
        data: row.twitter as unknown as Record<string, unknown>,
      };
    }
    if (row.user) {
      platformUser = {
        extractorType: "twitter",
        id: row.user.id,
        name: row.user.name ?? null,
        username: row.user.nick ?? null,
        profileImage: row.user.id
          ? `/api/avatar/twitter/${row.user.id}`
          : (row.user.profileImage ?? null),
        data: row.user as unknown as Record<string, unknown>,
      };
    }
  } else if (extractorType === "pixiv") {
    if (row.pixiv) {
      platformDetails = {
        extractorType: "pixiv",
        data: row.pixiv as unknown as Record<string, unknown>,
      };
    }
    if (row.pixivUser) {
      platformUser = {
        extractorType: "pixiv",
        id: row.pixivUser.id,
        name: row.pixivUser.name ?? null,
        username: row.pixivUser.account ?? null,
        profileImage: row.pixivUser.id
          ? `/api/avatar/pixiv/${row.pixivUser.id}`
          : (row.pixivUser.profileImage ?? null),
        data: row.pixivUser as unknown as Record<string, unknown>,
      };
    }
  } else if (extractorType === "gelbooruv02" || extractorType === "gelbooru") {
    if (row.gelbooru) {
      platformDetails = {
        extractorType: extractorType,
        data: row.gelbooru as unknown as Record<string, unknown>,
      };
    }
  } else if (extractorType === "ehentai") {
    if (row.ehentai) {
      platformDetails = {
        extractorType: "ehentai",
        data: row.ehentai as unknown as Record<string, unknown>,
      };
      if (row.ehentai.uploader) {
        platformUser = {
          extractorType: "ehentai",
          id: null,
          name: row.ehentai.uploader,
          username: row.ehentai.uploader,
          profileImage: null,
          data: {},
        };
      }
    }
  }

  return {
    item: row.item,
    post: row.post,
    platformDetails,
    platformUser,
    source: row.source,
  };
}

export async function getPostMediaItems(postId: number): Promise<GalleryRow[]> {
  const rawResults = await db
    .select({
      item: mediaItems,
      post: posts,
      twitter: postDetailsTwitter,
      pixiv: postDetailsPixiv,
      gelbooru: postDetailsGelbooruV02,
      ehentai: postDetailsEHentai,
      user: twitterUsers,
      pixivUser: pixivUsers,
      source: sources,
    })
    .from(mediaItems)
    .leftJoin(posts, eq(mediaItems.postId, posts.id))
    .leftJoin(postDetailsTwitter, eq(posts.id, postDetailsTwitter.postId))
    .leftJoin(postDetailsPixiv, eq(posts.id, postDetailsPixiv.postId))
    .leftJoin(
      postDetailsGelbooruV02,
      eq(posts.id, postDetailsGelbooruV02.postId),
    )
    .leftJoin(postDetailsEHentai, eq(posts.id, postDetailsEHentai.postId))
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
    .where(and(eq(mediaItems.postId, postId), ne(mediaItems.mediaType, "text")))
    .orderBy(asc(mediaItems.id));

  return rawResults.map((r) => flattenToGalleryRow(r));
}

export async function getMediaItems(filters?: {
  search?: string;
  sortBy?: string;
  limit?: number;
  cursor?: string;
  playlistId?: number;
}) {
  const limit = filters?.limit ?? 50;
  let search = filters?.search ?? "";
  const sortBy = filters?.sortBy ?? "created-desc";

  let isDynamicPlaylist = false;

  if (filters?.playlistId) {
    const playlistRecord = await db.query.playlists.findFirst({
      where: eq(playlists.id, filters.playlistId),
    });
    if (playlistRecord?.type === "dynamic") {
      isDynamicPlaylist = true;
      const dynamicQuery = playlistRecord.searchQuery ?? "";
      if (dynamicQuery) {
        search = search ? `${dynamicQuery} ${search}` : dynamicQuery;
      }
    }
  }

  const { cleanQuery, sourceFilter } = parseSearchQuery(search);
  const searchLower = cleanQuery.toLowerCase();

  // Expand search aliases at query-time
  const expandedSearch = searchLower ? await expandSearchTags(searchLower) : "";

  const whereConditions: SQL[] = [ne(mediaItems.mediaType, "text")];

  if (sourceFilter) {
    whereConditions.push(eq(posts.extractorType, sourceFilter));
  }

  if (filters?.playlistId && !isDynamicPlaylist) {
    const playlistItemSubquery = db
      .select({ mediaItemId: playlistItems.mediaItemId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, filters.playlistId));
    whereConditions.push(inArray(mediaItems.id, playlistItemSubquery));
  }

  const subqueryConditions: SQL[] = [ne(mediaItems.mediaType, "text")];

  if (sourceFilter) {
    const sourcePostSubquery = db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.extractorType, sourceFilter));
    subqueryConditions.push(inArray(mediaItems.postId, sourcePostSubquery));
  }

  if (filters?.playlistId && !isDynamicPlaylist) {
    const playlistItemSubquery = db
      .select({ mediaItemId: playlistItems.mediaItemId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, filters.playlistId));
    subqueryConditions.push(inArray(mediaItems.id, playlistItemSubquery));
  }

  const searchSubquery = expandedSearch
    ? db
        .select({
          search_id: sql<number>`rowid`.as("search_id"),
          rank: sql<number>`bm25(posts_fts, 10.0, 1.0, 5.0, 5.0, 2.0, 1.0)`.as(
            "rank",
          ),
        })
        .from(sql`posts_fts`)
        .where(sql`posts_fts MATCH ${expandedSearch}`)
        .as("search_subquery")
    : undefined;

  let groupQuery = db
    .select({
      minId: sql<number>`MIN(${mediaItems.id})`.as("min_id"),
      groupCount: sql<number>`COUNT(*)`.as("group_count"),
    })
    .from(mediaItems);

  if (searchSubquery) {
    groupQuery = groupQuery.innerJoin(
      searchSubquery,
      eq(mediaItems.postId, searchSubquery.search_id),
    ) as unknown as typeof groupQuery;
  }

  const groupSubquery = groupQuery
    .where(and(...subqueryConditions))
    .groupBy(sql`COALESCE(${mediaItems.postId}, -${mediaItems.id})`)
    .as("group_subquery");

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
      sortVal: sortValOutput, // include sortVal to easily compute the next cursor
      groupCount: groupSubquery.groupCount,
    })
    .from(mediaItems)
    .innerJoin(groupSubquery, eq(mediaItems.id, groupSubquery.minId))
    .$dynamic();

  // The grouping subquery already restricts rows to the FTS relation. Join
  // it again only for relevance sorting, where the rank column is required.
  if (searchSubquery && sortBy === "relevance") {
    resultsQuery = resultsQuery.innerJoin(
      searchSubquery,
      eq(mediaItems.postId, searchSubquery.search_id),
    );
  }

  if (sourceFilter) {
    resultsQuery = resultsQuery.leftJoin(
      posts,
      eq(mediaItems.postId, posts.id),
    );
  }

  const rawResults = (await resultsQuery
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(...orderBys)
    .limit(limit)) as {
    item: typeof mediaItems.$inferSelect;
    sortVal: unknown;
    groupCount: number;
  }[];

  let nextCursor: string | null = null;
  if (rawResults.length === limit) {
    const lastItem = rawResults[rawResults.length - 1];
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

  const targetIds = rawResults.map((r) => r.item.id);
  const detailsMap = await getMediaItemsByIds(targetIds);

  const items = rawResults.map((r) => {
    const fullRow = detailsMap[r.item.id] || {
      item: r.item,
      post: null,
      platformDetails: null,
      platformUser: null,
      source: null,
    };
    return {
      ...fullRow,
      groupCount: Number(r.groupCount || 1),
      groupItems: [fullRow],
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

export async function getMediaItemIds(filters?: {
  search?: string;
  sortBy?: string;
  playlistId?: number;
}): Promise<{ ids: number[]; totalCount: number }> {
  let search = filters?.search ?? "";
  const sortBy = filters?.sortBy ?? "created-desc";

  let isDynamicPlaylist = false;
  if (filters?.playlistId) {
    const playlistRecord = await db.query.playlists.findFirst({
      where: eq(playlists.id, filters.playlistId),
    });
    if (playlistRecord?.type === "dynamic") {
      isDynamicPlaylist = true;
      const dynamicQuery = playlistRecord.searchQuery ?? "";
      if (dynamicQuery) {
        search = search ? `${dynamicQuery} ${search}` : dynamicQuery;
      }
    }
  }

  const { cleanQuery, sourceFilter } = parseSearchQuery(search);
  const searchLower = cleanQuery.toLowerCase();
  const expandedSearch = searchLower ? await expandSearchTags(searchLower) : "";

  const whereConditions: SQL[] = [ne(mediaItems.mediaType, "text")];

  if (sourceFilter) {
    whereConditions.push(eq(posts.extractorType, sourceFilter));
  }

  if (filters?.playlistId && !isDynamicPlaylist) {
    const playlistItemSubquery = db
      .select({ mediaItemId: playlistItems.mediaItemId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, filters.playlistId));
    whereConditions.push(inArray(mediaItems.id, playlistItemSubquery));
  }

  const subqueryConditions: SQL[] = [ne(mediaItems.mediaType, "text")];

  if (sourceFilter) {
    const sourcePostSubquery = db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.extractorType, sourceFilter));
    subqueryConditions.push(inArray(mediaItems.postId, sourcePostSubquery));
  }

  if (expandedSearch) {
    const ftsPostSubquery = db
      .select({ id: sql<number>`rowid` })
      .from(sql`posts_fts`)
      .where(sql`posts_fts MATCH ${expandedSearch}`);
    subqueryConditions.push(inArray(mediaItems.postId, ftsPostSubquery));
  }

  if (filters?.playlistId && !isDynamicPlaylist) {
    const playlistItemSubquery = db
      .select({ mediaItemId: playlistItems.mediaItemId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, filters.playlistId));
    subqueryConditions.push(inArray(mediaItems.id, playlistItemSubquery));
  }

  const groupSubquery = db
    .select({
      minId: sql<number>`MIN(${mediaItems.id})`.as("min_id"),
    })
    .from(mediaItems)
    .where(and(...subqueryConditions))
    .groupBy(sql`COALESCE(${mediaItems.postId}, -${mediaItems.id})`)
    .as("group_subquery");

  const searchSubquery = expandedSearch
    ? db
        .select({
          search_id: sql<number>`rowid`.as("search_id"),
          rank: sql<number>`bm25(posts_fts, 10.0, 1.0, 5.0, 5.0, 2.0, 1.0)`.as(
            "rank",
          ),
        })
        .from(sql`posts_fts`)
        .where(sql`posts_fts MATCH ${expandedSearch}`)
        .as("search_subquery")
    : undefined;

  const orderBys: SQL[] = [];
  let sortField: SQL;
  if (sortBy.startsWith("captured")) {
    sortField = sql`COALESCE(${mediaItems.capturedAt}, ${mediaItems.createdAt}, 0)`;
  } else {
    sortField = sql`COALESCE(${mediaItems.createdAt}, 0)`;
  }

  if (sortBy === "relevance" && searchSubquery) {
    orderBys.push(asc(searchSubquery.rank), asc(mediaItems.id));
  } else if (sortBy.endsWith("-asc")) {
    orderBys.push(asc(sortField), asc(mediaItems.id));
  } else {
    orderBys.push(desc(sortField), desc(mediaItems.id));
  }

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic query typing
  let query: any = db
    .select({
      id: mediaItems.id,
    })
    .from(mediaItems)
    .innerJoin(groupSubquery, eq(mediaItems.id, groupSubquery.minId))
    .$dynamic();

  if (searchSubquery) {
    query = query.innerJoin(
      searchSubquery,
      eq(mediaItems.postId, searchSubquery.search_id),
    );
  }

  if (sourceFilter) {
    query = query.leftJoin(posts, eq(mediaItems.postId, posts.id));
  }

  const rows = (await query
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(...orderBys)) as { id: number }[];

  const ids = rows.map((r) => r.id);
  return { ids, totalCount: ids.length };
}

export async function getDynamicPlaylistMeta(
  searchQuery: string,
): Promise<{ itemCount: number; thumbnailPath?: string }> {
  const search = searchQuery ?? "";
  const { cleanQuery, sourceFilter } = parseSearchQuery(search);
  const searchLower = cleanQuery.toLowerCase();
  const expandedSearch = searchLower ? await expandSearchTags(searchLower) : "";

  const subqueryConditions: SQL[] = [ne(mediaItems.mediaType, "text")];

  if (sourceFilter) {
    const sourcePostSubquery = db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.extractorType, sourceFilter));
    subqueryConditions.push(inArray(mediaItems.postId, sourcePostSubquery));
  }

  if (expandedSearch) {
    const ftsPostSubquery = db
      .select({ id: sql<number>`rowid` })
      .from(sql`posts_fts`)
      .where(sql`posts_fts MATCH ${expandedSearch}`);
    subqueryConditions.push(inArray(mediaItems.postId, ftsPostSubquery));
  }

  const countRes = await db
    .select({
      count:
        sql<number>`COUNT(DISTINCT COALESCE(${mediaItems.postId}, -${mediaItems.id}))`.mapWith(
          Number,
        ),
    })
    .from(mediaItems)
    .where(and(...subqueryConditions));

  const thumbRes = await db
    .select({ filePath: mediaItems.filePath })
    .from(mediaItems)
    .where(and(...subqueryConditions))
    .orderBy(desc(mediaItems.id))
    .limit(1);

  return {
    itemCount: countRes[0]?.count || 0,
    thumbnailPath: thumbRes[0]?.filePath || undefined,
  };
}

export async function getMediaItemById(
  id: number,
): Promise<GalleryRow | undefined> {
  const results = await db
    .select({
      item: mediaItems,
      post: posts,
      twitter: postDetailsTwitter,
      pixiv: postDetailsPixiv,
      gelbooru: postDetailsGelbooruV02,
      ehentai: postDetailsEHentai,
      user: twitterUsers,
      pixivUser: pixivUsers,
      source: sources,
    })
    .from(mediaItems)
    .leftJoin(posts, eq(mediaItems.postId, posts.id))
    .leftJoin(postDetailsTwitter, eq(posts.id, postDetailsTwitter.postId))
    .leftJoin(postDetailsPixiv, eq(posts.id, postDetailsPixiv.postId))
    .leftJoin(
      postDetailsGelbooruV02,
      eq(posts.id, postDetailsGelbooruV02.postId),
    )
    .leftJoin(postDetailsEHentai, eq(posts.id, postDetailsEHentai.postId))
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
    .where(eq(mediaItems.id, id))
    .limit(1);

  if (results.length === 0) return undefined;
  return flattenToGalleryRow(results[0]);
}

export async function getMediaItemsByIds(
  ids: number[],
): Promise<Record<number, GalleryRow>> {
  if (ids.length === 0) return {};

  const results = await db
    .select({
      item: mediaItems,
      post: posts,
      twitter: postDetailsTwitter,
      pixiv: postDetailsPixiv,
      gelbooru: postDetailsGelbooruV02,
      ehentai: postDetailsEHentai,
      user: twitterUsers,
      pixivUser: pixivUsers,
      source: sources,
    })
    .from(mediaItems)
    .leftJoin(posts, eq(mediaItems.postId, posts.id))
    .leftJoin(postDetailsTwitter, eq(posts.id, postDetailsTwitter.postId))
    .leftJoin(postDetailsPixiv, eq(posts.id, postDetailsPixiv.postId))
    .leftJoin(
      postDetailsGelbooruV02,
      eq(posts.id, postDetailsGelbooruV02.postId),
    )
    .leftJoin(postDetailsEHentai, eq(posts.id, postDetailsEHentai.postId))
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
    .where(inArray(mediaItems.id, ids));

  const map: Record<number, GalleryRow> = {};
  for (const row of results) {
    map[row.item.id] = flattenToGalleryRow(row);
  }
  return map;
}

export async function getDynamicPlaylistPostIds(filters?: {
  search?: string;
}): Promise<{ postIds: number[]; totalCount: number }> {
  const search = filters?.search ?? "";
  const { cleanQuery, sourceFilter } = parseSearchQuery(search);
  const searchLower = cleanQuery.toLowerCase();
  const expandedSearch = searchLower ? await expandSearchTags(searchLower) : "";

  if (expandedSearch && !sourceFilter) {
    const rows = await db
      .select({
        postId: sql<number>`rowid`.mapWith(Number),
      })
      .from(sql`posts_fts`)
      .where(sql`posts_fts MATCH ${expandedSearch}`)
      .orderBy(desc(sql`rowid`));

    const postIds = rows.map((r) => r.postId);
    return { postIds, totalCount: postIds.length };
  }

  const subqueryConditions: SQL[] = [ne(mediaItems.mediaType, "text")];

  if (sourceFilter) {
    const sourcePostSubquery = db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.extractorType, sourceFilter));
    subqueryConditions.push(inArray(mediaItems.postId, sourcePostSubquery));
  }

  if (expandedSearch) {
    const ftsPostSubquery = db
      .select({ id: sql<number>`rowid` })
      .from(sql`posts_fts`)
      .where(sql`posts_fts MATCH ${expandedSearch}`);
    subqueryConditions.push(inArray(mediaItems.postId, ftsPostSubquery));
  }

  const rows = await db
    .select({
      postId:
        sql<number>`COALESCE(${mediaItems.postId}, -${mediaItems.id})`.mapWith(
          Number,
        ),
    })
    .from(mediaItems)
    .where(and(...subqueryConditions))
    .groupBy(sql`COALESCE(${mediaItems.postId}, -${mediaItems.id})`)
    .orderBy(desc(sql`COALESCE(${mediaItems.postId}, -${mediaItems.id})`));

  const postIds = rows.map((r) => r.postId);
  return { postIds, totalCount: postIds.length };
}

export async function getPostsForPlaylist(
  searchQuery: string,
  options?: { limit?: number; cursor?: string },
): Promise<{
  posts: PlaylistPost[];
  totalCount: number;
  nextCursor: string | null;
}> {
  const limit = options?.limit ?? 50;
  const { postIds, totalCount } = await getDynamicPlaylistPostIds({
    search: searchQuery,
  });

  let startIndex = 0;
  if (options?.cursor) {
    const cursorIdx = parseInt(options.cursor, 10);
    if (!Number.isNaN(cursorIdx)) {
      startIndex = cursorIdx;
    }
  }

  const pagePostIds = postIds.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < totalCount ? String(startIndex + limit) : null;

  if (pagePostIds.length === 0) {
    return { posts: [], totalCount, nextCursor: null };
  }

  const items = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        inArray(mediaItems.postId, pagePostIds),
        ne(mediaItems.mediaType, "text"),
      ),
    )
    .orderBy(desc(mediaItems.id));

  const postMap = new Map<number, (typeof mediaItems.$inferSelect)[]>();
  for (const pid of pagePostIds) {
    postMap.set(pid, []);
  }
  for (const item of items) {
    if (item.postId && postMap.has(item.postId)) {
      postMap.get(item.postId)!.push(item);
    }
  }

  const postsResult: PlaylistPost[] = pagePostIds
    .map((pid) => ({
      postId: pid,
      mediaItems: postMap.get(pid) || [],
    }))
    .filter((p) => p.mediaItems.length > 0);

  return { posts: postsResult, totalCount, nextCursor };
}

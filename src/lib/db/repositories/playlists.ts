import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaItems, playlistItems, playlists } from "@/lib/db/schema";
import type { PlaylistWithItems } from "@/types/playlist";

export async function getPlaylists(filters?: {
  sortBy?: string;
  search?: string;
}) {
  const sortBy = filters?.sortBy ?? "updated-desc";
  const search = filters?.search ?? "";

  let query = db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      thumbnail: playlists.thumbnail,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
      itemCount:
        sql<number>`(SELECT count(*) FROM ${playlistItems} WHERE ${playlistItems.playlistId} = ${playlists.id})`.mapWith(
          Number,
        ),
      thumbnailPath: sql<string>`(
        SELECT ${mediaItems.filePath} 
        FROM ${playlistItems} 
        JOIN ${mediaItems} ON ${playlistItems.mediaItemId} = ${mediaItems.id}
        WHERE ${playlistItems.playlistId} = ${playlists.id}
        ORDER BY ${playlistItems.position} ASC
        LIMIT 1
      )`,
    })
    .from(playlists)
    .$dynamic();

  const conditions = [];
  if (search) {
    conditions.push(like(playlists.name, `%${search}%`));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const orderBys = [];
  if (sortBy === "name-asc") {
    orderBys.push(asc(playlists.name));
  } else if (sortBy === "name-desc") {
    orderBys.push(desc(playlists.name));
  } else if (sortBy === "created-asc") {
    orderBys.push(asc(playlists.createdAt));
  } else if (sortBy === "created-desc") {
    orderBys.push(desc(playlists.createdAt));
  } else if (sortBy === "updated-asc") {
    orderBys.push(asc(playlists.updatedAt));
  } else if (sortBy === "count-desc") {
    orderBys.push(desc(sql`itemCount`), desc(playlists.updatedAt));
  } else if (sortBy === "count-asc") {
    orderBys.push(asc(sql`itemCount`), desc(playlists.updatedAt));
  } else {
    // Default: updated-desc
    orderBys.push(desc(playlists.updatedAt));
  }

  return await query.orderBy(...orderBys);
}

export async function getPlaylist(
  id: number,
): Promise<PlaylistWithItems | undefined> {
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, id),
  });

  if (!playlist) return undefined;

  const items = await db
    .select({
      id: playlistItems.id,
      playlistId: playlistItems.playlistId,
      mediaItemId: playlistItems.mediaItemId,
      position: playlistItems.position,
      addedAt: playlistItems.addedAt,
      mediaItem: mediaItems,
    })
    .from(playlistItems)
    .innerJoin(mediaItems, eq(playlistItems.mediaItemId, mediaItems.id))
    .where(eq(playlistItems.playlistId, id))
    .orderBy(asc(playlistItems.position));

  const count = items.length;
  const thumbnailPath =
    playlist.thumbnail || items[0]?.mediaItem?.filePath || undefined;

  return {
    ...playlist,
    itemCount: count,
    thumbnailPath,
    items,
  };
}

export async function getPlaylistsForMediaItem(mediaItemId: number) {
  return await db
    .select({
      id: playlists.id,
      name: playlists.name,
    })
    .from(playlists)
    .innerJoin(playlistItems, eq(playlistItems.playlistId, playlists.id))
    .where(eq(playlistItems.mediaItemId, mediaItemId));
}

export async function createPlaylist(name: string, description?: string) {
  const now = new Date();
  const result = await db
    .insert(playlists)
    .values({
      name,
      description,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return result[0];
}

export async function updatePlaylist(
  id: number,
  updates: { name?: string; description?: string; thumbnail?: string },
) {
  const now = new Date();
  await db
    .update(playlists)
    .set({
      ...updates,
      updatedAt: now,
    })
    .where(eq(playlists.id, id));
}

export async function deletePlaylist(id: number) {
  await db.delete(playlists).where(eq(playlists.id, id));
}

export async function addItemsToPlaylist(
  playlistId: number,
  mediaItemIds: number[],
) {
  if (mediaItemIds.length === 0) return;

  const maxPosResult = await db
    .select({ maxPos: sql<number>`MAX(${playlistItems.position})` })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId));

  const currentMax = maxPosResult[0]?.maxPos ?? -1;
  const now = new Date();

  const insertRows = mediaItemIds.map((mediaItemId, index) => ({
    playlistId,
    mediaItemId,
    position: currentMax + 1 + index,
    addedAt: now,
  }));

  await db.insert(playlistItems).values(insertRows);

  await db
    .update(playlists)
    .set({ updatedAt: now })
    .where(eq(playlists.id, playlistId));
}

export async function compactPlaylistPositions(playlistId: number) {
  const now = new Date();
  const items = await db
    .select({ id: playlistItems.id })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(asc(playlistItems.position));

  for (let i = 0; i < items.length; i++) {
    await db
      .update(playlistItems)
      .set({ position: i })
      .where(eq(playlistItems.id, items[i].id));
  }

  await db
    .update(playlists)
    .set({ updatedAt: now })
    .where(eq(playlists.id, playlistId));
}

export async function removeItemsFromPlaylist(
  playlistId: number,
  playlistItemIds: number[],
) {
  if (playlistItemIds.length === 0) return;

  await db
    .delete(playlistItems)
    .where(
      and(
        eq(playlistItems.playlistId, playlistId),
        inArray(playlistItems.id, playlistItemIds),
      ),
    );

  await compactPlaylistPositions(playlistId);
}

export async function reorderPlaylistItems(
  playlistId: number,
  orderedItemIds: number[],
) {
  const now = new Date();
  for (let i = 0; i < orderedItemIds.length; i++) {
    await db
      .update(playlistItems)
      .set({ position: i })
      .where(
        and(
          eq(playlistItems.id, orderedItemIds[i]),
          eq(playlistItems.playlistId, playlistId),
        ),
      );
  }

  await db
    .update(playlists)
    .set({ updatedAt: now })
    .where(eq(playlists.id, playlistId));
}

export async function movePlaylistItem(
  playlistId: number,
  playlistItemId: number,
  direction: "up" | "down",
) {
  const currentItem = await db.query.playlistItems.findFirst({
    where: and(
      eq(playlistItems.id, playlistItemId),
      eq(playlistItems.playlistId, playlistId),
    ),
  });

  if (!currentItem) return;

  const currentPos = currentItem.position;
  const targetPos = direction === "up" ? currentPos - 1 : currentPos + 1;

  if (targetPos < 0) return;

  const adjacentItem = await db.query.playlistItems.findFirst({
    where: and(
      eq(playlistItems.playlistId, playlistId),
      eq(playlistItems.position, targetPos),
    ),
  });

  if (!adjacentItem) {
    await compactPlaylistPositions(playlistId);
    return;
  }

  const now = new Date();

  await db
    .update(playlistItems)
    .set({ position: targetPos })
    .where(eq(playlistItems.id, playlistItemId));

  await db
    .update(playlistItems)
    .set({ position: currentPos })
    .where(eq(playlistItems.id, adjacentItem.id));

  await db
    .update(playlists)
    .set({ updatedAt: now })
    .where(eq(playlists.id, playlistId));
}

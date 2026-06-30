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

const testDb = testDbHelper.db;
activeDb = testDb;

// Import modules under test
import { eq } from "drizzle-orm";
import { playlistItems } from "../schema";
import {
  addItemsToPlaylist,
  compactPlaylistPositions,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  getPlaylists,
  getPlaylistsForMediaItem,
  movePlaylistItem,
  removeItemsFromPlaylist,
  reorderPlaylistItems,
  updatePlaylist,
} from "./playlists";

describe("Playlists Repository", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  describe("Playlist CRUD", () => {
    it("should create, get, update, and delete a playlist", async () => {
      // 1. Create
      const playlist = await createPlaylist(
        "Anime Favs",
        "My favorite anime media",
      );
      expect(playlist.id).toBeTypeOf("number");
      expect(playlist.name).toBe("Anime Favs");
      expect(playlist.description).toBe("My favorite anime media");

      // 2. Get Single
      const fetched = await getPlaylist(playlist.id);
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe("Anime Favs");
      expect(fetched?.itemCount).toBe(0);

      // 3. Update
      await updatePlaylist(playlist.id, {
        name: "Anime Favorites",
        description: "Updated desc",
      });
      const updated = await getPlaylist(playlist.id);
      expect(updated?.name).toBe("Anime Favorites");
      expect(updated?.description).toBe("Updated desc");

      // 4. Get List
      const list = await getPlaylists({ search: "Anime" });
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(playlist.id);

      // 5. Delete
      await deletePlaylist(playlist.id);
      const deleted = await getPlaylist(playlist.id);
      expect(deleted).toBeUndefined();
    });

    it("should list playlists with correct sorting", async () => {
      const pl1 = await createPlaylist("B Playlist");
      const pl2 = await createPlaylist("A Playlist");

      // Name sorting
      const ascList = await getPlaylists({ sortBy: "name-asc" });
      expect(ascList[0].id).toBe(pl2.id);
      expect(ascList[1].id).toBe(pl1.id);

      const descList = await getPlaylists({ sortBy: "name-desc" });
      expect(descList[0].id).toBe(pl1.id);
      expect(descList[1].id).toBe(pl2.id);
    });
  });

  describe("Playlist Item Management", () => {
    let playlistId: number;
    let mediaId1: number;
    let mediaId2: number;
    let mediaId3: number;

    beforeEach(async () => {
      const playlist = await createPlaylist("Test Playlist");
      playlistId = playlist.id;

      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media1 = await seedMediaItem(testDb, post.id);
      const media2 = await seedMediaItem(testDb, post.id);
      const media3 = await seedMediaItem(testDb, post.id);

      mediaId1 = media1.id;
      mediaId2 = media2.id;
      mediaId3 = media3.id;
    });

    it("should add items to playlist and maintain correct positions", async () => {
      await addItemsToPlaylist(playlistId, [mediaId1, mediaId2]);

      const playlist = await getPlaylist(playlistId);
      expect(playlist?.itemCount).toBe(2);
      expect(playlist?.items[0].mediaItemId).toBe(mediaId1);
      expect(playlist?.items[0].position).toBe(0);
      expect(playlist?.items[1].mediaItemId).toBe(mediaId2);
      expect(playlist?.items[1].position).toBe(1);

      // Add another item
      await addItemsToPlaylist(playlistId, [mediaId3]);
      const updatedPlaylist = await getPlaylist(playlistId);
      expect(updatedPlaylist?.itemCount).toBe(3);
      expect(updatedPlaylist?.items[2].mediaItemId).toBe(mediaId3);
      expect(updatedPlaylist?.items[2].position).toBe(2);
    });

    it("should compact playlist positions correctly", async () => {
      await addItemsToPlaylist(playlistId, [mediaId1, mediaId2, mediaId3]);

      // Manually mess up positions in DB
      await testDb
        .update(playlistItems)
        .set({ position: 10 })
        .where(eq(playlistItems.mediaItemId, mediaId1));
      await testDb
        .update(playlistItems)
        .set({ position: 20 })
        .where(eq(playlistItems.mediaItemId, mediaId2));
      await testDb
        .update(playlistItems)
        .set({ position: 30 })
        .where(eq(playlistItems.mediaItemId, mediaId3));

      await compactPlaylistPositions(playlistId);

      const playlist = await getPlaylist(playlistId);
      expect(playlist?.items[0].position).toBe(0);
      expect(playlist?.items[1].position).toBe(1);
      expect(playlist?.items[2].position).toBe(2);
    });

    it("should remove items from playlist and re-compact positions", async () => {
      await addItemsToPlaylist(playlistId, [mediaId1, mediaId2, mediaId3]);

      const playlistBefore = await getPlaylist(playlistId);
      const itemIdToRemove = playlistBefore?.items[1].id; // Remove the second item (mediaId2)

      expect(itemIdToRemove).toBeDefined();
      if (itemIdToRemove) {
        await removeItemsFromPlaylist(playlistId, [itemIdToRemove]);
      }

      const playlistAfter = await getPlaylist(playlistId);
      expect(playlistAfter?.itemCount).toBe(2);
      expect(playlistAfter?.items[0].mediaItemId).toBe(mediaId1);
      expect(playlistAfter?.items[0].position).toBe(0);
      expect(playlistAfter?.items[1].mediaItemId).toBe(mediaId3);
      expect(playlistAfter?.items[1].position).toBe(1); // Should be compacted to position 1
    });

    it("should reorder playlist items", async () => {
      await addItemsToPlaylist(playlistId, [mediaId1, mediaId2, mediaId3]);

      const playlistBefore = await getPlaylist(playlistId);
      const itemIds = playlistBefore?.items.map((i) => i.id) || [];
      expect(itemIds.length).toBe(3);

      // Reverse order: item3, item2, item1
      await reorderPlaylistItems(playlistId, [
        itemIds[2],
        itemIds[1],
        itemIds[0],
      ]);

      const playlistAfter = await getPlaylist(playlistId);
      expect(playlistAfter?.items[0].mediaItemId).toBe(mediaId3);
      expect(playlistAfter?.items[0].position).toBe(0);
      expect(playlistAfter?.items[1].mediaItemId).toBe(mediaId2);
      expect(playlistAfter?.items[1].position).toBe(1);
      expect(playlistAfter?.items[2].mediaItemId).toBe(mediaId1);
      expect(playlistAfter?.items[2].position).toBe(2);
    });

    it("should move items up and down", async () => {
      await addItemsToPlaylist(playlistId, [mediaId1, mediaId2, mediaId3]);

      const playlistBefore = await getPlaylist(playlistId);
      const itemIds = playlistBefore?.items.map((i) => i.id) || [];

      // Move item2 (idx 1) up
      await movePlaylistItem(playlistId, itemIds[1], "up");
      let current = await getPlaylist(playlistId);
      expect(current?.items[0].mediaItemId).toBe(mediaId2);
      expect(current?.items[0].position).toBe(0);
      expect(current?.items[1].mediaItemId).toBe(mediaId1);
      expect(current?.items[1].position).toBe(1);

      // Move item2 (now idx 0) down
      await movePlaylistItem(playlistId, itemIds[1], "down");
      current = await getPlaylist(playlistId);
      expect(current?.items[0].mediaItemId).toBe(mediaId1);
      expect(current?.items[0].position).toBe(0);
      expect(current?.items[1].mediaItemId).toBe(mediaId2);
      expect(current?.items[1].position).toBe(1);
    });

    it("should find playlists for a media item", async () => {
      await addItemsToPlaylist(playlistId, [mediaId1]);

      const containingPlaylists = await getPlaylistsForMediaItem(mediaId1);
      expect(containingPlaylists.length).toBe(1);
      expect(containingPlaylists[0].id).toBe(playlistId);

      const notContaining = await getPlaylistsForMediaItem(mediaId2);
      expect(notContaining.length).toBe(0);
    });
  });
});

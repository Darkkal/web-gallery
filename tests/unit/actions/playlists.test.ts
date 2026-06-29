import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../helpers/db";
import { seedMediaItem, seedPost, seedSource } from "../helpers/seed";

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

import { eq } from "drizzle-orm";
// Import modules under test
import {
  addItemsToPlaylist,
  bulkDeletePlaylists,
  createPlaylist,
  deletePlaylist,
  getPlaylistsForMediaItem,
  movePlaylistItem,
  removeItemsFromPlaylist,
  reorderPlaylistItems,
  updatePlaylist,
} from "@/app/actions/playlists";
import { playlistItems, playlists } from "@/lib/db/schema";

describe("Playlists Server Actions", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  describe("createPlaylist", () => {
    it("should create a new playlist", async () => {
      const playlist = await createPlaylist(
        "My Playlist",
        "Awesome collection",
      );
      expect(playlist.name).toBe("My Playlist");
      expect(playlist.description).toBe("Awesome collection");

      const dbPlaylist = await testDb.query.playlists.findFirst({
        where: eq(playlists.id, playlist.id),
      });
      expect(dbPlaylist).not.toBeUndefined();
      expect(dbPlaylist?.name).toBe("My Playlist");
    });
  });

  describe("updatePlaylist", () => {
    it("should update playlist details", async () => {
      const playlist = await createPlaylist("Old Name");
      const res = await updatePlaylist(playlist.id, { name: "New Name" });
      expect(res.success).toBe(true);

      const dbPlaylist = await testDb.query.playlists.findFirst({
        where: eq(playlists.id, playlist.id),
      });
      expect(dbPlaylist?.name).toBe("New Name");
    });
  });

  describe("deletePlaylist", () => {
    it("should delete a playlist", async () => {
      const playlist = await createPlaylist("To Delete");
      const res = await deletePlaylist(playlist.id);
      expect(res.success).toBe(true);

      const dbPlaylist = await testDb.query.playlists.findFirst({
        where: eq(playlists.id, playlist.id),
      });
      expect(dbPlaylist).toBeUndefined();
    });
  });

  describe("bulkDeletePlaylists", () => {
    it("should bulk delete playlists", async () => {
      const p1 = await createPlaylist("P1");
      const p2 = await createPlaylist("P2");

      const res = await bulkDeletePlaylists([p1.id, p2.id]);
      expect(res.success).toBe(true);

      const all = await testDb.select().from(playlists);
      expect(all.length).toBe(0);
    });
  });

  describe("addItemsToPlaylist and getPlaylistsForMediaItem", () => {
    it("should add media items to playlist and fetch them by media item", async () => {
      const playlist = await createPlaylist("My Playlist");
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media = await seedMediaItem(testDb, post.id);

      const res = await addItemsToPlaylist(playlist.id, [media.id]);
      expect(res.success).toBe(true);

      const items = await testDb.select().from(playlistItems);
      expect(items.length).toBe(1);
      expect(items[0].playlistId).toBe(playlist.id);
      expect(items[0].mediaItemId).toBe(media.id);

      // Verify getPlaylistsForMediaItem
      const usersPlaylists = await getPlaylistsForMediaItem(media.id);
      expect(usersPlaylists.length).toBe(1);
      expect(usersPlaylists[0].id).toBe(playlist.id);
    });
  });

  describe("removeItemsFromPlaylist", () => {
    it("should remove items from playlist", async () => {
      const playlist = await createPlaylist("My Playlist");
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media = await seedMediaItem(testDb, post.id);

      await addItemsToPlaylist(playlist.id, [media.id]);
      const itemsBefore = await testDb.select().from(playlistItems);
      expect(itemsBefore.length).toBe(1);

      const res = await removeItemsFromPlaylist(playlist.id, [
        itemsBefore[0].id,
      ]);
      expect(res.success).toBe(true);

      const itemsAfter = await testDb.select().from(playlistItems);
      expect(itemsAfter.length).toBe(0);
    });
  });

  describe("reorderPlaylistItems", () => {
    it("should reorder playlist items", async () => {
      const playlist = await createPlaylist("My Playlist");
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media1 = await seedMediaItem(testDb, post.id, {
        filePath: "m1.jpg",
      });
      const media2 = await seedMediaItem(testDb, post.id, {
        filePath: "m2.jpg",
      });

      await addItemsToPlaylist(playlist.id, [media1.id, media2.id]);
      const items = await testDb
        .select()
        .from(playlistItems)
        .orderBy(playlistItems.position);

      // Current positions: items[0] is position 0, items[1] is position 1
      // Reverse order: orderedItemIds = [items[1].id, items[0].id]
      const res = await reorderPlaylistItems(playlist.id, [
        items[1].id,
        items[0].id,
      ]);
      expect(res.success).toBe(true);

      const updated = await testDb
        .select()
        .from(playlistItems)
        .orderBy(playlistItems.position);
      expect(updated[0].id).toBe(items[1].id);
      expect(updated[1].id).toBe(items[0].id);
    });
  });

  describe("movePlaylistItem", () => {
    it("should move playlist items position up or down", async () => {
      const playlist = await createPlaylist("My Playlist");
      const source = await seedSource(testDb);
      const post = await seedPost(testDb, source.id);
      const media1 = await seedMediaItem(testDb, post.id, {
        filePath: "m1.jpg",
      });
      const media2 = await seedMediaItem(testDb, post.id, {
        filePath: "m2.jpg",
      });

      await addItemsToPlaylist(playlist.id, [media1.id, media2.id]);
      const items = await testDb
        .select()
        .from(playlistItems)
        .orderBy(playlistItems.position);

      // Move the second item up
      const res = await movePlaylistItem(playlist.id, items[1].id, "up");
      expect(res.success).toBe(true);

      const updated = await testDb
        .select()
        .from(playlistItems)
        .orderBy(playlistItems.position);
      expect(updated[0].id).toBe(items[1].id);
      expect(updated[1].id).toBe(items[0].id);
    });
  });
});

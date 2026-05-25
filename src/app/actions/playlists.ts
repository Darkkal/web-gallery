"use server";

import { revalidatePath } from "next/cache";
import * as playlistRepo from "@/lib/db/repositories/playlists";

export async function createPlaylist(name: string, description?: string) {
  const result = await playlistRepo.createPlaylist(name, description);
  revalidatePath("/playlists");
  return result;
}

export async function updatePlaylist(
  id: number,
  updates: { name?: string; description?: string; thumbnail?: string },
) {
  await playlistRepo.updatePlaylist(id, updates);
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${id}`);
  return { success: true };
}

export async function deletePlaylist(id: number) {
  await playlistRepo.deletePlaylist(id);
  revalidatePath("/playlists");
  return { success: true };
}

export async function bulkDeletePlaylists(ids: number[]) {
  for (const id of ids) {
    await playlistRepo.deletePlaylist(id);
  }
  revalidatePath("/playlists");
  return { success: true };
}

export async function addItemsToPlaylist(
  playlistId: number,
  mediaItemIds: number[],
) {
  await playlistRepo.addItemsToPlaylist(playlistId, mediaItemIds);
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${playlistId}`);
  return { success: true };
}

export async function removeItemsFromPlaylist(
  playlistId: number,
  playlistItemIds: number[],
) {
  await playlistRepo.removeItemsFromPlaylist(playlistId, playlistItemIds);
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${playlistId}`);
  return { success: true };
}

export async function reorderPlaylistItems(
  playlistId: number,
  orderedItemIds: number[],
) {
  await playlistRepo.reorderPlaylistItems(playlistId, orderedItemIds);
  revalidatePath(`/playlists/${playlistId}`);
  return { success: true };
}

export async function movePlaylistItem(
  playlistId: number,
  playlistItemId: number,
  direction: "up" | "down",
) {
  await playlistRepo.movePlaylistItem(playlistId, playlistItemId, direction);
  revalidatePath(`/playlists/${playlistId}`);
  return { success: true };
}

export async function getPlaylistsForMediaItem(mediaItemId: number) {
  return await playlistRepo.getPlaylistsForMediaItem(mediaItemId);
}

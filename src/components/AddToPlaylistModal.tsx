"use client";

import { Plus, Search, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { addItemsToPlaylist, createPlaylist } from "@/app/actions/playlists";
import styles from "@/components/AddToPlaylistModal.module.css";
import type { Playlist } from "@/types/playlist";

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItemIds: number[];
}

export default function AddToPlaylistModal({
  isOpen,
  onClose,
  mediaItemIds,
}: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingToId, setAddingToId] = useState<number | null>(null);

  const loadPlaylists = useCallback(async () => {
    try {
      const res = await fetch("/api/playlists?sort=updated-desc");
      if (!res.ok) throw new Error("Failed to load playlists");
      const data = await res.json();
      setPlaylists(data);
    } catch (err) {
      console.error("Failed to load playlists:", err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
      setSearch("");
    }
  }, [isOpen, loadPlaylists]);

  if (!isOpen) return null;

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleAddToExisting(playlistId: number) {
    if (loading || mediaItemIds.length === 0) return;
    setAddingToId(playlistId);
    setLoading(true);
    try {
      await addItemsToPlaylist(playlistId, mediaItemIds);
      onClose();
    } catch (err) {
      console.error("Failed to add items to playlist:", err);
      alert("Failed to add items to playlist");
    } finally {
      setLoading(false);
      setAddingToId(null);
    }
  }

  async function handleCreateAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !search.trim() || mediaItemIds.length === 0) return;

    setLoading(true);
    try {
      const newPlaylist = await createPlaylist(search.trim());
      if (newPlaylist?.id) {
        await addItemsToPlaylist(newPlaylist.id, mediaItemIds);
      }
      onClose();
    } catch (err) {
      console.error("Failed to create and add:", err);
      alert("Failed to create playlist and add items");
    } finally {
      setLoading(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Modal backdrop click
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop click propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Stop click propagation */}
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Add to Playlist</h2>
            <p className={styles.modalSubtitle}>
              Adding {mediaItemIds.length}{" "}
              {mediaItemIds.length === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreateAndAdd} className={styles.searchForm}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search or create a playlist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // biome-ignore lint/a11y/noAutofocus: Autofocus on open for quick interaction
              autoFocus
            />
          </div>
          {search.trim() &&
            !playlists.some(
              (p) => p.name.toLowerCase() === search.trim().toLowerCase(),
            ) && (
              <button
                type="submit"
                className={styles.createBtn}
                disabled={loading}
                title="Create and add items"
              >
                <Plus size={16} />
                Create
              </button>
            )}
        </form>

        <div className={styles.playlistList}>
          {filteredPlaylists.map((playlist) => {
            const isAdding = addingToId === playlist.id;
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: Clickable list item
              // biome-ignore lint/a11y/noStaticElementInteractions: Clickable list item
              <div
                key={playlist.id}
                className={`${styles.playlistItem} ${isAdding ? styles.adding : ""}`}
                onClick={() => handleAddToExisting(playlist.id)}
              >
                <div className={styles.playlistItemInfo}>
                  <span className={styles.playlistName}>{playlist.name}</span>
                  <span className={styles.playlistCount}>
                    {playlist.itemCount ?? 0}{" "}
                    {playlist.itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
                {isAdding && (
                  <span className={styles.addingIndicator}>Adding...</span>
                )}
              </div>
            );
          })}

          {filteredPlaylists.length === 0 && !search.trim() && (
            <div className={styles.emptyState}>
              No playlists yet. Type above to create one!
            </div>
          )}

          {filteredPlaylists.length === 0 && search.trim() && (
            <div className={styles.emptyState}>
              No matching playlists. Click <strong>Create</strong> above to
              create &quot;{search}&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

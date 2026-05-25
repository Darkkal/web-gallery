"use client";

import {
  ArrowDown,
  ArrowUp,
  Edit,
  GalleryHorizontal,
  GripVertical,
  Play,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import {
  deletePlaylist,
  movePlaylistItem,
  removeItemsFromPlaylist,
  reorderPlaylistItems,
  updatePlaylist,
} from "@/app/actions/playlists";
import styles from "@/app/playlists/[id]/page.module.css";
import CreatePlaylistModal from "@/app/playlists/components/CreatePlaylistModal";
import type { PlaylistWithItems } from "@/types/playlist";

interface PlaylistDetailPageClientProps {
  initialPlaylist: PlaylistWithItems;
}

export default function PlaylistDetailPageClient({
  initialPlaylist,
}: PlaylistDetailPageClientProps) {
  const router = useRouter();
  const [playlist, setPlaylist] = useState<PlaylistWithItems>(initialPlaylist);
  const [modalOpen, setModalOpen] = useState(false);

  // Drag states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  async function reloadPlaylist() {
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`);
      if (!res.ok) throw new Error("Failed to load playlist details");
      const data = await res.json();
      setPlaylist(data);
    } catch (err) {
      console.error("Error reloading playlist:", err);
    }
  }

  async function handleEditPlaylist(name: string, description?: string) {
    await updatePlaylist(playlist.id, { name, description });
    await reloadPlaylist();
  }

  async function handleDeletePlaylist() {
    if (
      !confirm(
        `Are you sure you want to permanently delete the playlist "${playlist.name}"?`,
      )
    ) {
      return;
    }
    await deletePlaylist(playlist.id);
    router.push("/playlists");
  }

  async function handleRemoveItem(playlistItemId: number) {
    if (!confirm("Remove this item from the playlist?")) return;
    await removeItemsFromPlaylist(playlist.id, [playlistItemId]);
    await reloadPlaylist();
  }

  async function handleMoveItem(
    playlistItemId: number,
    direction: "up" | "down",
  ) {
    await movePlaylistItem(playlist.id, playlistItemId, direction);
    await reloadPlaylist();
  }

  // HTML5 Drag and Drop handlers
  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Set a dummy payload for browser compatibility
    e.dataTransfer.setData("text/plain", index.toString());
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  }

  async function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const sourceIndex = draggedIndex;

    setDraggedIndex(null);
    setDragOverIndex(null);

    if (sourceIndex === null || sourceIndex === targetIndex) return;

    // Perform optimistic local reorder
    const itemsCopy = [...playlist.items];
    const [removed] = itemsCopy.splice(sourceIndex, 1);
    itemsCopy.splice(targetIndex, 0, removed);

    const reorderedItems = itemsCopy.map((item, idx) => ({
      ...item,
      position: idx,
    }));

    setPlaylist((prev) => ({
      ...prev,
      items: reorderedItems,
    }));

    // Call server action to write to database
    try {
      const orderedIds = reorderedItems.map((item) => item.id);
      await reorderPlaylistItems(playlist.id, orderedIds);
    } catch (err) {
      console.error("Failed to persist new playlist order:", err);
      alert("Failed to save reorder. Reloading...");
    } finally {
      await reloadPlaylist();
    }
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.titleWrapper}>
            <h1 className={styles.title}>{playlist.name}</h1>
            <span className={styles.badge}>
              {playlist.itemCount} {playlist.itemCount === 1 ? "item" : "items"}
            </span>
          </div>
          {playlist.description && (
            <p className={styles.description}>{playlist.description}</p>
          )}
          <span className={styles.meta}>
            Created{" "}
            {new Date(playlist.createdAt ?? new Date()).toLocaleDateString()}{" "}
            &bull; Updated{" "}
            {new Date(
              playlist.updatedAt ?? playlist.createdAt ?? new Date(),
            ).toLocaleDateString()}
          </span>
        </div>

        <div className={styles.headerActions}>
          {playlist.items.length > 0 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => router.push(`/playlists/${playlist.id}/player`)}
            >
              <Play size={16} fill="currentColor" />
              Play
            </button>
          )}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => router.push(`/gallery?playlist=${playlist.id}`)}
          >
            <GalleryHorizontal size={16} />
            Gallery
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setModalOpen(true)}
          >
            <Edit size={16} />
            Edit Details
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDestructive}`}
            onClick={handleDeletePlaylist}
          >
            <Trash2 size={16} />
            Delete Playlist
          </button>
        </div>
      </div>

      {playlist.items.length > 0 ? (
        <div className={styles.itemList}>
          {playlist.items.map((item, index) => {
            const media = item.mediaItem;
            if (!media) return null;
            const isImage = media.mediaType === "image";
            const filename = media.filePath.split("/").pop() ?? "Untitled";

            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: Draggable item row trigger
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`${styles.itemRow} ${isDragging ? styles.dragging : ""} ${
                  isDragOver ? styles.dragOver : ""
                }`}
              >
                {/* Drag Handle */}
                <div className={styles.dragHandle} title="Drag to reorder">
                  <GripVertical size={18} />
                </div>

                {/* Position index */}
                <div className={styles.position}>{index + 1}</div>

                {/* Thumbnail Preview */}
                <div className={styles.thumbWrapper}>
                  {media.mediaType === "video" ? (
                    <video
                      src={`${media.filePath}#t=0.1`}
                      className={styles.thumbVideo}
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <Image
                      src={media.filePath}
                      alt=""
                      fill
                      className={styles.thumb}
                      unoptimized
                    />
                  )}
                  {!isImage && (
                    <div className={styles.videoBadge}>{media.mediaType}</div>
                  )}
                </div>

                {/* Meta details */}
                <div className={styles.itemDetails}>
                  <div className={styles.fileName}>{filename}</div>
                  <div className={styles.itemMeta}>
                    <span>
                      Added{" "}
                      {new Date(
                        item.addedAt ?? new Date(),
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Move & Remove Controls */}
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleMoveItem(item.id, "up")}
                    disabled={index === 0}
                    title="Move item up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleMoveItem(item.id, "down")}
                    disabled={index === playlist.items.length - 1}
                    title="Move item down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.destructive}`}
                    onClick={() => handleRemoveItem(item.id)}
                    title="Remove from playlist"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>This playlist has no items yet.</p>
          <div className={styles.emptyStateActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => router.push("/gallery")}
            >
              Browse Gallery to Add Items
            </button>
          </div>
        </div>
      )}

      {/* Edit Details Dialog Modal */}
      <CreatePlaylistModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleEditPlaylist}
        initialName={playlist.name}
        initialDescription={playlist.description ?? ""}
        title="Edit Playlist Details"
      />
    </div>
  );
}

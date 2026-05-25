"use client";

import { Edit2, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import styles from "@/app/playlists/page.module.css";
import type { Playlist } from "@/types/playlist";

interface PlaylistCardProps {
  playlist: Playlist;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PlaylistCard({
  playlist,
  isSelected,
  onToggleSelection,
  onPlay,
  onEdit,
  onDelete,
}: PlaylistCardProps) {
  const router = useRouter();
  const itemCount = playlist.itemCount ?? 0;
  const thumbnail = playlist.thumbnailPath || playlist.thumbnail;

  function handleCardClick(e: React.MouseEvent) {
    // If clicking on checkboxes or action buttons, don't trigger navigation
    const target = e.target as HTMLElement;
    if (
      target.closest(`.${styles.checkboxOverlay}`) ||
      target.closest(`.${styles.cardActions}`) ||
      target.closest("a")
    ) {
      return;
    }
    router.push(`/playlists/${playlist.id}`);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Playlist card click trigger
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ""}`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
        }
      }}
    >
      {thumbnail ? (
        <div
          className={styles.cardBg}
          style={{ backgroundImage: `url("${thumbnail}")` }}
        />
      ) : (
        <div className={styles.placeholderCardBg}>
          <span>Empty Playlist</span>
        </div>
      )}

      <div className={styles.cardOverlay}>
        <div className={styles.cardTop}>
          <div className={styles.checkboxOverlay}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={isSelected}
              onChange={onToggleSelection}
              aria-label={`Select playlist ${playlist.name}`}
            />
          </div>
          <div className={styles.badge}>
            {itemCount === 1 ? "1 item" : `${itemCount} items`}
          </div>
        </div>

        <div className={styles.cardBottom}>
          <Link href={`/playlists/${playlist.id}`} className={styles.rowTitle}>
            <h3 className={styles.cardTitle}>{playlist.name}</h3>
          </Link>
          {playlist.description && (
            <p className={styles.cardDescription}>{playlist.description}</p>
          )}

          <div className={styles.cardMeta}>
            <span>
              Updated{" "}
              {new Date(
                playlist.updatedAt ?? playlist.createdAt ?? new Date(),
              ).toLocaleDateString()}
            </span>

            <div className={styles.cardActions}>
              {itemCount > 0 && (
                <button
                  type="button"
                  className={styles.cardActionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay();
                  }}
                  title="Play playlist"
                >
                  <Play size={14} fill="currentColor" />
                </button>
              )}
              <button
                type="button"
                className={styles.cardActionBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Edit details"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className={`${styles.cardActionBtn} ${styles.destructive}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete playlist"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

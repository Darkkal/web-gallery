"use client";

import { Edit2, Play, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import styles from "@/app/playlists/page.module.css";
import type { Playlist } from "@/types/playlist";

interface PlaylistTableRowProps {
  playlist: Playlist;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PlaylistTableRow({
  playlist,
  isSelected,
  onToggleSelection,
  onPlay,
  onEdit,
  onDelete,
}: PlaylistTableRowProps) {
  const itemCount = playlist.itemCount ?? 0;
  const thumbnail = playlist.thumbnailPath || playlist.thumbnail;

  return (
    <tr className={`${styles.tableRow} ${isSelected ? styles.selected : ""}`}>
      <td className={styles.thCheck}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={onToggleSelection}
          aria-label={`Select playlist ${playlist.name}`}
        />
      </td>

      <td className={styles.thThumb}>
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            className={styles.thumbnail}
            width={44}
            height={44}
            unoptimized
          />
        ) : (
          <div className={styles.placeholderThumb}>Empty</div>
        )}
      </td>

      <td className={styles.thActions}>
        <div className={styles.tableActions}>
          {itemCount > 0 && (
            <button
              type="button"
              className={styles.rowIconButton}
              onClick={onPlay}
              title="Play playlist"
            >
              <Play size={16} fill="currentColor" />
            </button>
          )}
          <button
            type="button"
            className={styles.rowIconButton}
            onClick={onEdit}
            title="Edit details"
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            className={`${styles.rowIconButton} ${styles.destructive}`}
            onClick={onDelete}
            title="Delete playlist"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>

      <td>
        <Link href={`/playlists/${playlist.id}`} className={styles.rowTitle}>
          {playlist.name}
        </Link>
        {playlist.description && (
          <div className={styles.rowDesc}>{playlist.description}</div>
        )}
      </td>

      <td>{itemCount === 1 ? "1 item" : `${itemCount} items`}</td>

      <td>
        {new Date(
          playlist.updatedAt ?? playlist.createdAt ?? new Date(),
        ).toLocaleDateString()}
      </td>
    </tr>
  );
}

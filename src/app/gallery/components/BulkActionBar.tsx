"use client";

import styles from "@/app/gallery/page.module.css";

interface BulkActionBarProps {
  selectedCount: number;
  onBulkDelete: (deleteFiles: boolean) => void;
  onAddToPlaylist: () => void;
  deleting: boolean;
}

export default function BulkActionBar({
  selectedCount,
  onBulkDelete,
  onAddToPlaylist,
  deleting,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={styles.bulkActionBar}>
      <span>{selectedCount} items selected</span>
      <div className={styles.bulkActionButtons}>
        <button
          type="button"
          className={styles.playlistButton}
          onClick={onAddToPlaylist}
          disabled={deleting}
        >
          Add to Playlist
        </button>
        <button
          type="button"
          className={styles.secondaryDeleteButton}
          onClick={() => onBulkDelete(false)}
          disabled={deleting}
        >
          {deleting ? "..." : "Delete from DB"}
        </button>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => onBulkDelete(true)}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete from Disk & DB"}
        </button>
      </div>
    </div>
  );
}

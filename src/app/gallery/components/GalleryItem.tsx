"use client";

import Image from "next/image";
import styles from "@/app/gallery/page.module.css";
import { handleKeyActivate } from "@/lib/utils/a11y";
import type { GalleryGroup } from "@/types/media";

interface GalleryItemProps {
  row: GalleryGroup;
  isSelected: boolean;
  selectionMode: boolean;
  onClick: () => void;
}

export default function GalleryItem({
  row,
  isSelected,
  selectionMode,
  onClick,
}: GalleryItemProps) {
  const item = row.item;
  const count = row.groupCount || 1;

  const handleVideoPlay = async (target: HTMLVideoElement) => {
    try {
      await target.play();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error(err);
      }
    }
  };

  const handleVideoPause = (target: HTMLVideoElement) => {
    target.pause();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: Maintains current styling structure
    <div
      className={`${styles.item} ${isSelected ? styles.selectedItem : ""}`}
      onClick={onClick}
      onKeyDown={handleKeyActivate(onClick)}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
    >
      {selectionMode && (
        <div className={styles.checkbox}>{isSelected ? "✓" : ""}</div>
      )}

      {count > 1 && (
        <div className={styles.countBadge} title={`${count} items`}>
          <span>❐</span> {count}
        </div>
      )}

      {item.mediaType === "video" ? (
        <>
          <video
            src={item.filePath}
            className={styles.media}
            muted
            loop
            tabIndex={0}
            onMouseOver={(e) => handleVideoPlay(e.currentTarget)}
            onMouseOut={(e) => handleVideoPause(e.currentTarget)}
            onFocus={(e) => handleVideoPlay(e.currentTarget)}
            onBlur={(e) => handleVideoPause(e.currentTarget)}
          />
          <div className={styles.videoBadge}>VIDEO</div>
        </>
      ) : (
        <Image
          src={item.filePath}
          alt={row.post?.title || "Media thumbnail"}
          className={styles.media}
          width={400}
          height={400}
          style={{ width: "100%", height: "auto" }}
          unoptimized
        />
      )}
    </div>
  );
}

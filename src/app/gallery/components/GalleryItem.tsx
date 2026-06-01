"use client";

import Image from "next/image";
import styles from "@/app/gallery/page.module.css";
import { useAutoplayVideo } from "@/hooks/useAutoplayVideo";
import { handleKeyActivate } from "@/lib/utils/a11y";
import type { GalleryGroup } from "@/types/media";

interface GalleryItemProps {
  row: GalleryGroup;
  isSelected: boolean;
  selectionMode: boolean;
  autoplayVideos: boolean;
  muteAutoplayVideos: boolean;
  onClick: () => void;
  id?: string;
}

export default function GalleryItem({
  row,
  isSelected,
  selectionMode,
  autoplayVideos,
  muteAutoplayVideos,
  onClick,
  id,
}: GalleryItemProps) {
  const item = row.item;
  const count = row.groupCount || 1;
  const videoRef = useAutoplayVideo(autoplayVideos, muteAutoplayVideos);

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
      id={id}
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

      {row.post?.isSourceDeleted && (
        <div
          className={styles.deletedSourceBadge}
          title="Post is no longer available on remote source"
        >
          🚫 Deleted from Source
        </div>
      )}

      {item.mediaType === "video" ? (
        <>
          <video
            ref={videoRef}
            src={item.filePath}
            className={styles.media}
            muted
            loop
            tabIndex={0}
            onMouseOver={(e) =>
              !autoplayVideos && handleVideoPlay(e.currentTarget)
            }
            onMouseOut={(e) =>
              !autoplayVideos && handleVideoPause(e.currentTarget)
            }
            onFocus={(e) => !autoplayVideos && handleVideoPlay(e.currentTarget)}
            onBlur={(e) => !autoplayVideos && handleVideoPause(e.currentTarget)}
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

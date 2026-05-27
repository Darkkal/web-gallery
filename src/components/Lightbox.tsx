"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPlaylistsForMediaItem } from "@/app/actions/playlists";
import { getPostTags } from "@/app/actions/tags";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";
import FormattedContent from "@/components/FormattedContent";
import styles from "@/components/Lightbox.module.css";
import type {
  UnifiedGelbooruv02Data,
  UnifiedPixivData,
  UnifiedTwitterData,
  UnifiedUserData,
} from "@/lib/metadata";
import { handleKeyActivate } from "@/lib/utils/a11y";
import type { GalleryRow } from "@/types/media";

interface LightboxProps {
  row: GalleryRow;
  groupItems?: GalleryRow[];
  tweet?: UnifiedTwitterData;
  user?: UnifiedUserData;
  pixiv?: UnifiedPixivData;
  pixivUser?: UnifiedUserData;
  gelbooru?: UnifiedGelbooruv02Data;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onDelete?: (id: number, deleteFile: boolean) => void;
  loopVideos?: boolean;
  isPageLoading?: boolean;
}

export default function Lightbox({
  row,
  groupItems = [],
  tweet,
  user,
  pixiv,
  pixivUser,
  gelbooru,
  onClose,
  onNext,
  onPrev,
  onDelete,
  loopVideos,
  isPageLoading = false,
}: LightboxProps) {
  const { item } = row;
  const [showInfo, setShowInfo] = useState(true);
  const [pixivTags, setPixivTags] = useState<{ name: string }[]>([]);
  const [isRecentlyMounted, setIsRecentlyMounted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Playlists State
  const [associatedPlaylists, setAssociatedPlaylists] = useState<
    { id: number; name: string }[]
  >([]);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [addToPlaylistIds, setAddToPlaylistIds] = useState<number[]>([]);

  // Load playlists that this item belongs to
  useEffect(() => {
    let active = true;
    async function loadPlaylists() {
      try {
        const data = await getPlaylistsForMediaItem(item.id);
        if (active) {
          setAssociatedPlaylists(data);
        }
      } catch (err) {
        console.error("Failed to load associated playlists:", err);
      }
    }
    loadPlaylists();
    return () => {
      active = false;
    };
  }, [item.id]);

  function handleOpenAddToPlaylist(ids: number[]) {
    setAddToPlaylistIds(ids);
    setIsAddToPlaylistOpen(true);
  }

  function handleCloseAddToPlaylist() {
    setIsAddToPlaylistOpen(false);
    getPlaylistsForMediaItem(item.id)
      .then(setAssociatedPlaylists)
      .catch(console.error);
  }

  // Prevent mobile click-through/ghost click events on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRecentlyMounted(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Touch swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartX.current;
    const diffY = touch.clientY - touchStartY.current;

    // Check if swipe is horizontal and exceeds threshold (50px)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        if (onPrev) onPrev();
      } else {
        if (onNext && !isPageLoading) onNext();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Lock body scroll on mount, restore on unmount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Fetch Pixiv Tags
  useEffect(() => {
    if (pixiv?.id) {
      getPostTags(pixiv.id).then(setPixivTags).catch(console.error);
    } else {
      // eslint-disable-next-line
      setPixivTags([]);
    }
  }, [pixiv?.id]);

  const tags = gelbooru?.tags
    ? gelbooru.tags.map((tag) => ({ name: tag, id: 0 }))
    : pixivTags;

  // Handle video playback errors
  useEffect(() => {
    if (item.mediaType === "video" && videoRef.current) {
      const playVideo = async () => {
        try {
          await videoRef.current?.play();
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== "AbortError") {
            console.error("Video playback error:", err);
          }
        }
      };
      playVideo();
    }
  }, [item.mediaType]);

  async function handleDeleteDB() {
    if (!onDelete) return;
    if (
      confirm("Delete this record from the database? (File will stay on disk)")
    ) {
      onDelete(item.id, false);
    }
  }

  async function handleDeleteDisk() {
    if (!onDelete) return;
    if (confirm("Permanently delete this file from disk and database?")) {
      onDelete(item.id, true);
    }
  }

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && onNext && !isPageLoading) onNext();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
    },
    [onClose, onNext, onPrev, isPageLoading],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!item) return null;

  // Format dates
  const capturedDate = item.capturedAt ? new Date(item.capturedAt) : null;
  const createdDate = item.createdAt ? new Date(item.createdAt) : null;

  const formattedCapturedDate = capturedDate
    ? capturedDate.toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "medium",
      })
    : "Unknown";

  const formattedCreatedDate = createdDate
    ? createdDate.toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "medium",
      })
    : null;

  return (
    <div
      className={styles.overlay}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Image Area */}
      {/* biome-ignore lint/a11y/useSemanticElements: Maintains current styling structure */}
      <div
        className={styles.mainArea}
        onClick={(e) => {
          // If clicking the background (not the image), close?
          // Or maybe clicking image toggles sidebar?
          // Let's make clicking background close.
          if (e.target === e.currentTarget) {
            if (isRecentlyMounted) return;
            onClose();
          }
        }}
        onKeyDown={handleKeyActivate(() => {
          if (typeof window !== "undefined") {
            // Check if we are actually on the target area, though handleKeyActivate handles the key
            onClose();
          }
        })}
        role="button"
        tabIndex={0}
        aria-label="Close lightbox"
      >
        {onPrev && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.prevButton}`}
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
          >
            ‹
          </button>
        )}

        <div className={styles.mediaWrapper}>
          {item.mediaType === "video" ? (
            // biome-ignore lint/a11y/useMediaCaption: User generated content does not have captions
            <video
              ref={videoRef}
              src={item.filePath}
              className={styles.video}
              controls
              loop={loopVideos}
              onClick={(e) => e.stopPropagation()}
            />
          ) : item.mediaType === "text" ? (
            // biome-ignore lint/a11y/useSemanticElements: Maintains current styling structure
            <div
              className={styles.textContent}
              onClick={(e) => {
                // Don't toggle info if clicking a link
                if ((e.target as HTMLElement).tagName === "A") return;
                e.stopPropagation();
                setShowInfo(!showInfo);
              }}
              onKeyDown={handleKeyActivate(() => {
                setShowInfo(!showInfo);
              })}
              role="button"
              tabIndex={0}
            >
              <FormattedContent content={row.post?.title || ""} />
            </div>
          ) : (
            <Image
              src={item.filePath}
              alt={row.post?.title || "Gallery Image"}
              className={styles.image}
              onClick={(e) => {
                e.stopPropagation();
                if (isRecentlyMounted) return;
                if (typeof window !== "undefined" && window.innerWidth >= 768) {
                  setShowInfo(!showInfo);
                }
              }}
              width={1200}
              height={800}
              unoptimized
            />
          )}
        </div>

        {onNext && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.nextButton} ${isPageLoading ? styles.loadingButton : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isPageLoading) return;
              onNext();
            }}
            disabled={isPageLoading}
            title={isPageLoading ? "Loading next page..." : "Next"}
          >
            {isPageLoading ? <span className={styles.spinner} /> : "›"}
          </button>
        )}

        <div className={styles.controls}>
          {onDelete && (
            <>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.deleteDBButton}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDB();
                }}
                title="Delete from DB ONLY"
              >
                🗑<span className={styles.buttonBadge}>DB</span>
              </button>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.deleteDiskButton}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDisk();
                }}
                title="Delete from Disk & DB"
              >
                🗑<span className={styles.buttonBadge}>P</span>
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.iconButton}
            onClick={(e) => {
              e.stopPropagation();
              setShowInfo(!showInfo);
            }}
            title="Toggle Info"
          >
            ⓘ
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`${styles.sidebar} ${!showInfo ? styles.sidebarHidden : ""}`}
      >
        <button
          type="button"
          className={styles.sidebarCloseMobile}
          onClick={() => setShowInfo(false)}
        >
          ▾ Hide Info
        </button>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>
            {tweet ? null : pixiv?.title || row.post?.title || "Untitled"}
          </h2>
        </div>

        {user && (
          <div className={`${styles.section} ${styles.userCard}`}>
            {user.profileImage && (
              <Image
                src={user.profileImage || ""}
                alt={user.name || "User"}
                width={48}
                height={48}
                className={styles.avatar}
              />
            )}
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userHandle}>
                @{user.nick || user.username}
              </span>
            </div>
          </div>
        )}

        {pixivUser && (
          <div className={`${styles.section} ${styles.userCard}`}>
            {pixivUser.profileImage && (
              <Image
                src={pixivUser.profileImage || ""}
                alt={pixivUser.name || "User"}
                width={48}
                height={48}
                className={styles.avatar}
              />
            )}
            <div className={styles.userInfo}>
              <span className={styles.userName}>{pixivUser.name}</span>
              <span className={styles.userHandle}>@{pixivUser.account}</span>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Details</h3>
          <div className={styles.sectionContent}>
            <FormattedContent
              content={
                pixiv?.caption ||
                row.post?.content ||
                tweet?.content ||
                "No description available."
              }
            />
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Date Details</h3>
          <div className={styles.sectionContent}>
            <div className={styles.dateRow}>
              <span className={styles.dateLabel}>Original Post:</span>{" "}
              <span className={styles.dateValue}>{formattedCapturedDate}</span>
            </div>
            {formattedCreatedDate && (
              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>Imported to Library:</span>{" "}
                <span className={styles.dateValue}>{formattedCreatedDate}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Playlists</h3>
          <div className={styles.sectionContent}>
            {associatedPlaylists.length > 0 ? (
              <div className={styles.playlistChips}>
                {associatedPlaylists.map((p) => (
                  <Link
                    key={p.id}
                    href={`/playlists/${p.id}`}
                    className={styles.playlistChip}
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.mutedText}>Not in any playlists.</div>
            )}

            <div className={styles.playlistActionButtons}>
              <button
                type="button"
                className={styles.sidebarActionBtn}
                onClick={() => handleOpenAddToPlaylist([item.id])}
              >
                + Add Item
              </button>
              {groupItems.length > 1 && (
                <button
                  type="button"
                  className={styles.sidebarActionBtn}
                  onClick={() =>
                    handleOpenAddToPlaylist(groupItems.map((gi) => gi.item.id))
                  }
                >
                  + Add Post Items ({groupItems.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {tweet && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Twitter Stats</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{tweet.favoriteCount}</span>
                <span className={styles.statLabel}>Likes</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{tweet.retweetCount}</span>
                <span className={styles.statLabel}>Retweets</span>
              </div>
              {tweet.viewCount && (
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{tweet.viewCount}</span>
                  <span className={styles.statLabel}>Views</span>
                </div>
              )}
              {tweet.bookmarkCount && (
                <div className={styles.statItem}>
                  <span className={styles.statValue}>
                    {tweet.bookmarkCount}
                  </span>
                  <span className={styles.statLabel}>Bookmarks</span>
                </div>
              )}
            </div>
          </div>
        )}

        {pixiv && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Pixiv Stats</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{pixiv.totalBookmarks}</span>
                <span className={styles.statLabel}>Bookmarks</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{pixiv.totalView}</span>
                <span className={styles.statLabel}>Views</span>
              </div>
              {(pixiv.pageCount || 0) > 1 && (
                <div className={styles.statItem}>
                  <span className={styles.statValue}>
                    {pixiv.pageCount || 0}
                  </span>
                  <span className={styles.statLabel}>Pages</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gelbooru Info */}
        {gelbooru && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Gelbooru Info</h3>
            <div className={styles.statsGrid}>
              {gelbooru.source && (
                <div className={`${styles.statItem} ${styles.statItemFull}`}>
                  {/* Assuming Link component is available or replace with <a> */}
                  {/* <Link size={16} /> */}
                  <a
                    href={gelbooru.source || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    Source
                  </a>
                </div>
              )}
              <div className={styles.statItem}>
                {/* Assuming Heart component is available or replace with icon */}
                {/* <Heart size={16} /> */}
                <span className={styles.statValue}>{gelbooru.score || 0}</span>
                <span className={styles.statLabel}>Score</span>
              </div>
              {gelbooru.rating && (
                <div className={styles.statItem}>
                  <span className={styles.badge}>{gelbooru.rating}</span>
                  <span className={styles.statLabel}>Rating</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Tags</h3>
            <div className={styles.tagsContainer}>
              {tags.map((tag, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: Stable sorted tags
                  key={i}
                  className={styles.tagChip}
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {(row.post?.url || (tweet?.tweetId && user) || pixiv?.pixivId) && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Source</h3>
            {row.post?.url && (
              <a
                href={row.post.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.linkButton}
              >
                Open Original Post
              </a>
            )}
            {tweet?.tweetId && user && (
              <a
                href={`https://twitter.com/${user.nick || user.username}/status/${tweet.tweetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.linkButton}
              >
                View Tweet
              </a>
            )}
            {pixiv?.pixivId && (
              <a
                href={`https://www.pixiv.net/artworks/${pixiv.pixivId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.linkButton}
              >
                View on Pixiv
              </a>
            )}
          </div>
        )}
      </div>

      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={handleCloseAddToPlaylist}
        mediaItemIds={addToPlaylistIds}
      />
    </div>
  );
}

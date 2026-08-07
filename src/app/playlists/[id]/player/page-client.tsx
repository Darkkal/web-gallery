"use client";

import {
  ChevronsLeft,
  ChevronsRight,
  Maximize,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/app/playlists/[id]/player/page.module.css";
import type { GalleryRow, MediaItem } from "@/types/media";
import type { PlaylistWithItems } from "@/types/playlist";

interface PlaylistPlayerPageClientProps {
  initialPlaylist: PlaylistWithItems;
}

export default function PlaylistPlayerPageClient({
  initialPlaylist,
}: PlaylistPlayerPageClientProps) {
  const router = useRouter();
  const playlist = initialPlaylist;
  const isDynamic = playlist.type === "dynamic";

  // --- Dynamic Playlist State (Post-Based) ---
  const [allPostIds, setAllPostIds] = useState<number[]>(() =>
    playlist.posts ? playlist.posts.map((p) => p.postId) : [],
  );
  const [postMediaMap, setPostMediaMap] = useState<Record<number, MediaItem[]>>(
    () => {
      const initialMap: Record<number, MediaItem[]> = {};
      if (playlist.posts) {
        for (const p of playlist.posts) {
          initialMap[p.postId] = p.mediaItems;
        }
      }
      return initialMap;
    },
  );
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  // --- Normal Playlist State (Item-Based) ---
  const [allItemIds, setAllItemIds] = useState<number[]>(() =>
    playlist.items.map((it) => it.mediaItemId),
  );
  const [mediaCache, setMediaCache] = useState<Record<number, GalleryRow>>(
    () => {
      const initialMap: Record<number, GalleryRow> = {};
      for (const it of playlist.items) {
        if (it.mediaItem) {
          initialMap[it.mediaItemId] = {
            item: it.mediaItem,
            post: null,
            platformDetails: null,
            platformUser: null,
            source: null,
          };
        }
      }
      return initialMap;
    },
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- General Player Controls State ---
  const [isPlaying, setIsPlaying] = useState(true);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [shuffleCursor, setShuffleCursor] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const [_viewMode, _setViewMode] = useState<"single" | "multi">("single");
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load post IDs if dynamic
  useEffect(() => {
    if (isDynamic) {
      fetch(`/api/playlists/${playlist.id}/post-ids`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.postIds) && data.postIds.length > 0) {
            setAllPostIds(data.postIds);
          }
        })
        .catch((err) =>
          console.error("Failed to load full dynamic playlist post IDs:", err),
        );
    }
  }, [playlist.id, isDynamic]);

  // Auto-hide controls timeout
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

    if (!isHoveringControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isHoveringControls]);

  useEffect(() => {
    window.addEventListener("mousemove", resetControlsTimeout);
    window.addEventListener("touchstart", resetControlsTimeout);
    resetControlsTimeout();

    return () => {
      window.removeEventListener("mousemove", resetControlsTimeout);
      window.removeEventListener("touchstart", resetControlsTimeout);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  useEffect(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Fisher-Yates Shuffle generator
  const totalUnits = isDynamic ? allPostIds.length : allItemIds.length;
  const enableShuffle = useCallback(
    (startIndex: number, isLoopTransition = false) => {
      if (totalUnits === 0) return;
      const indices = Array.from({ length: totalUnits }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      if (isLoopTransition) {
        if (indices[0] === startIndex && indices.length > 1) {
          const j = Math.floor(Math.random() * (indices.length - 1)) + 1;
          [indices[0], indices[j]] = [indices[j], indices[0]];
        }
      } else {
        const currentIdxInShuffled = indices.indexOf(startIndex);
        if (currentIdxInShuffled !== -1) {
          indices.splice(currentIdxInShuffled, 1);
          indices.unshift(startIndex);
        }
      }

      setShuffledIndices(indices);
      setShuffleCursor(0);
    },
    [totalUnits],
  );

  const activeUnitIndex = isDynamic ? currentPostIndex : currentIndex;
  const handleToggleShuffle = useCallback(() => {
    if (!shuffle) {
      enableShuffle(activeUnitIndex);
      setShuffle(true);
    } else {
      setShuffle(false);
    }
  }, [shuffle, enableShuffle, activeUnitIndex]);

  // Active item resolution
  const activePostIndex =
    isDynamic && shuffle && shuffledIndices.length === allPostIds.length
      ? shuffledIndices[shuffleCursor]
      : currentPostIndex;

  const activePostId = isDynamic ? allPostIds[activePostIndex] : undefined;
  const currentPostMedia =
    isDynamic && activePostId !== undefined
      ? postMediaMap[activePostId] || []
      : [];

  const activeMediaId =
    !isDynamic && shuffle && shuffledIndices.length === allItemIds.length
      ? allItemIds[shuffledIndices[shuffleCursor]]
      : allItemIds[currentIndex];

  const currentMedia: MediaItem | undefined = isDynamic
    ? currentPostMedia[currentMediaIndex]
    : mediaCache[activeMediaId]?.item;

  const isVideo = currentMedia?.mediaType === "video";

  // Prefetch post media (Dynamic)
  useEffect(() => {
    if (!isDynamic || allPostIds.length === 0) return;

    const targetPostIndices: number[] = [];
    for (let offset = 0; offset <= 2; offset++) {
      const idx = (shuffleCursor + offset) % allPostIds.length;
      targetPostIndices.push(idx);
    }

    const missingPostIds = targetPostIndices
      .map((i) => (shuffle ? allPostIds[shuffledIndices[i]] : allPostIds[i]))
      .filter((id) => id !== undefined && !postMediaMap[id]);

    if (missingPostIds.length > 0) {
      for (const pid of missingPostIds) {
        fetch(`/api/posts/${pid}/media`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data.mediaItems)) {
              setPostMediaMap((prev) => ({
                ...prev,
                [pid]: data.mediaItems,
              }));
            }
          })
          .catch((err) =>
            console.error(`Failed to prefetch media for post ${pid}:`, err),
          );
      }
    }
  }, [
    isDynamic,
    allPostIds,
    shuffleCursor,
    shuffle,
    shuffledIndices,
    postMediaMap,
  ]);

  // Prefetch items (Normal)
  useEffect(() => {
    if (isDynamic || allItemIds.length === 0) return;

    const activePos =
      shuffle && shuffledIndices.length === allItemIds.length
        ? shuffleCursor
        : currentIndex;

    const targetIndices: number[] = [];
    for (let offset = 0; offset <= 3; offset++) {
      const idx = (activePos + offset) % allItemIds.length;
      targetIndices.push(idx);
    }

    const missingIds = targetIndices
      .map((i) => (shuffle ? allItemIds[shuffledIndices[i]] : allItemIds[i]))
      .filter((id) => id !== undefined && !mediaCache[id]);

    if (missingIds.length > 0) {
      fetch(`/api/media/batch?ids=${missingIds.join(",")}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.items) {
            setMediaCache((prev) => ({ ...prev, ...data.items }));
          }
        })
        .catch((err) => console.error("Failed to prefetch media items:", err));
    }
  }, [
    isDynamic,
    currentIndex,
    shuffleCursor,
    shuffle,
    shuffledIndices,
    allItemIds,
    mediaCache,
  ]);

  // Post Navigation
  const handleNextPost = useCallback(() => {
    if (allPostIds.length <= 1) return;
    setCurrentMediaIndex(0);

    if (shuffle && shuffledIndices.length === allPostIds.length) {
      const nextCursor = shuffleCursor + 1;
      if (nextCursor < allPostIds.length) {
        setShuffleCursor(nextCursor);
      } else if (repeat) {
        enableShuffle(shuffledIndices[shuffleCursor], true);
      } else {
        setIsPlaying(false);
      }
    } else {
      const nextIndex = currentPostIndex + 1;
      if (nextIndex < allPostIds.length) {
        setCurrentPostIndex(nextIndex);
      } else if (repeat) {
        setCurrentPostIndex(0);
      } else {
        setIsPlaying(false);
      }
    }
  }, [
    allPostIds.length,
    shuffle,
    shuffledIndices,
    shuffleCursor,
    repeat,
    currentPostIndex,
    enableShuffle,
  ]);

  const handlePrevPost = useCallback(
    (startAtEnd = false) => {
      if (allPostIds.length <= 1) return;

      const targetPostId =
        shuffle && shuffledIndices.length === allPostIds.length
          ? allPostIds[shuffledIndices[shuffleCursor]]
          : allPostIds[currentPostIndex];

      let targetPostMedia: MediaItem[] = [];

      if (shuffle && shuffledIndices.length === allPostIds.length) {
        const prevCursor = shuffleCursor - 1;
        if (prevCursor >= 0) {
          setShuffleCursor(prevCursor);
          const prevPostId = allPostIds[shuffledIndices[prevCursor]];
          targetPostMedia = postMediaMap[prevPostId] || [];
        } else if (repeat) {
          const lastCursor = allPostIds.length - 1;
          setShuffleCursor(lastCursor);
          const prevPostId = allPostIds[shuffledIndices[lastCursor]];
          targetPostMedia = postMediaMap[prevPostId] || [];
        }
      } else {
        const prevIndex = currentPostIndex - 1;
        if (prevIndex >= 0) {
          setCurrentPostIndex(prevIndex);
          targetPostMedia = postMediaMap[allPostIds[prevIndex]] || [];
        } else if (repeat) {
          const lastIndex = allPostIds.length - 1;
          setCurrentPostIndex(lastIndex);
          targetPostMedia = postMediaMap[allPostIds[lastIndex]] || [];
        }
      }

      if (startAtEnd && targetPostMedia.length > 0) {
        setCurrentMediaIndex(targetPostMedia.length - 1);
      } else {
        setCurrentMediaIndex(0);
      }
    },
    [
      allPostIds,
      shuffle,
      shuffledIndices,
      shuffleCursor,
      repeat,
      currentPostIndex,
      postMediaMap,
    ],
  );

  // General Next / Prev (Media-level)
  const handleNext = useCallback(() => {
    if (isDynamic) {
      if (currentMediaIndex < currentPostMedia.length - 1) {
        setCurrentMediaIndex((prev) => prev + 1);
      } else {
        handleNextPost();
      }
    } else {
      if (allItemIds.length <= 1) return;
      if (shuffle && shuffledIndices.length === allItemIds.length) {
        const nextCursor = shuffleCursor + 1;
        if (nextCursor < allItemIds.length) {
          setShuffleCursor(nextCursor);
        } else if (repeat) {
          enableShuffle(shuffledIndices[shuffleCursor], true);
        } else {
          setIsPlaying(false);
        }
      } else {
        const nextIndex = currentIndex + 1;
        if (nextIndex < allItemIds.length) {
          setCurrentIndex(nextIndex);
        } else if (repeat) {
          setCurrentIndex(0);
        } else {
          setIsPlaying(false);
        }
      }
    }
  }, [
    isDynamic,
    currentMediaIndex,
    currentPostMedia.length,
    handleNextPost,
    allItemIds.length,
    shuffle,
    shuffledIndices,
    shuffleCursor,
    repeat,
    currentIndex,
    enableShuffle,
  ]);

  const handlePrev = useCallback(() => {
    if (isDynamic) {
      if (currentMediaIndex > 0) {
        setCurrentMediaIndex((prev) => prev - 1);
      } else {
        handlePrevPost(true);
      }
    } else {
      if (allItemIds.length <= 1) return;
      if (shuffle && shuffledIndices.length === allItemIds.length) {
        const prevCursor = shuffleCursor - 1;
        if (prevCursor >= 0) {
          setShuffleCursor(prevCursor);
        } else if (repeat) {
          setShuffleCursor(allItemIds.length - 1);
        }
      } else {
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          setCurrentIndex(prevIndex);
        } else if (repeat) {
          setCurrentIndex(allItemIds.length - 1);
        }
      }
    }
  }, [
    isDynamic,
    currentMediaIndex,
    handlePrevPost,
    allItemIds.length,
    shuffle,
    shuffledIndices,
    shuffleCursor,
    repeat,
    currentIndex,
  ]);

  // Sync index with shuffle cursor
  useEffect(() => {
    if (shuffle && shuffledIndices.length === totalUnits) {
      if (isDynamic) {
        setCurrentPostIndex(shuffledIndices[shuffleCursor]);
      } else {
        setCurrentIndex(shuffledIndices[shuffleCursor]);
      }
    }
  }, [shuffle, shuffledIndices, shuffleCursor, totalUnits, isDynamic]);

  // Autoplay handler
  useEffect(() => {
    if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    setProgress(0);

    if (!isPlaying || !currentMedia) return;
    if (currentMedia.mediaType === "video") return;

    const IMAGE_DURATION = 5000;
    const TICK_RATE = 50;
    let elapsed = 0;

    autoplayTimerRef.current = setInterval(() => {
      elapsed += TICK_RATE;
      const pct = Math.min((elapsed / IMAGE_DURATION) * 100, 100);
      setProgress(pct);

      if (elapsed >= IMAGE_DURATION) {
        clearInterval(autoplayTimerRef.current as NodeJS.Timeout);
        handleNext();
      }
    }, TICK_RATE);

    return () => {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    };
  }, [isPlaying, currentMedia, handleNext]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current && isVideo) {
      if (isPlaying) {
        videoRef.current.play().catch((err) => {
          if (err.name !== "AbortError") console.error("Play failed:", err);
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, isVideo]);

  useEffect(() => {
    if (videoRef.current && isVideo && currentMedia) {
      videoRef.current.load();
      if (isPlayingRef.current) {
        videoRef.current.play().catch((err) => {
          if (err.name !== "AbortError") console.error("Autoplay failed:", err);
        });
      }
    }
  }, [currentMedia, isVideo]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      if (total > 0) {
        setProgress((current / total) * 100);
      }
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case "Escape":
          router.push(`/playlists/${playlist.id}`);
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "PageDown":
        case "ArrowDown":
          if (isDynamic) {
            e.preventDefault();
            handleNextPost();
          }
          break;
        case "PageUp":
        case "ArrowUp":
          if (isDynamic) {
            e.preventDefault();
            handlePrevPost();
          }
          break;
        case "r":
        case "R":
          setRepeat((prev) => !prev);
          break;
        case "s":
        case "S":
          handleToggleShuffle();
          break;
        default:
          break;
      }
    },
    [
      handleNext,
      handlePrev,
      handleNextPost,
      handlePrevPost,
      handleToggleShuffle,
      isDynamic,
      playlist.id,
      router,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!currentMedia) return null;

  const shouldShowControlsBar = showControls && !(isVideo && isPlaying);

  return (
    <div className={styles.playerContainer}>
      <button
        type="button"
        className={`${styles.closeButton} ${!showControls ? styles.hidden : ""}`}
        onClick={() => router.push(`/playlists/${playlist.id}`)}
        onMouseEnter={() => setIsHoveringControls(true)}
        onMouseLeave={() => setIsHoveringControls(false)}
        title="Exit player (Esc)"
      >
        <X size={20} />
      </button>

      <div className={styles.mediaWrapper}>
        {isVideo ? (
          // biome-ignore lint/a11y/useMediaCaption: User content
          <video
            ref={videoRef}
            src={currentMedia.filePath}
            className={styles.mediaVideo}
            controls
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleNext}
            onTimeUpdate={handleVideoTimeUpdate}
          />
        ) : (
          <Image
            src={currentMedia.filePath}
            alt=""
            fill
            className={styles.mediaImage}
            unoptimized
          />
        )}
      </div>

      <div
        className={`${styles.controlsBar} ${!shouldShowControlsBar ? styles.hidden : ""}`}
        onMouseEnter={() => setIsHoveringControls(true)}
        onMouseLeave={() => setIsHoveringControls(false)}
        role="toolbar"
        aria-label="Player controls"
      >
        {!isVideo && (
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        )}

        <div className={styles.controlGroup}>
          {isDynamic && (
            <button
              type="button"
              className={styles.controlBtn}
              onClick={() => handlePrevPost()}
              disabled={allPostIds.length <= 1}
              title="Previous Post (PageUp / Down Arrow)"
            >
              <ChevronsLeft size={18} />
            </button>
          )}

          <button
            type="button"
            className={styles.controlBtn}
            onClick={handlePrev}
            disabled={
              isDynamic ? allPostIds.length === 0 : allItemIds.length <= 1
            }
            title="Previous Media (Left Arrow)"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>

          <button
            type="button"
            className={`${styles.controlBtn} ${styles.playPauseBtn}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" color="black" />
            ) : (
              <Play
                size={18}
                fill="currentColor"
                color="black"
                style={{ marginLeft: "2px" }}
              />
            )}
          </button>

          <button
            type="button"
            className={styles.controlBtn}
            onClick={handleNext}
            disabled={
              isDynamic ? allPostIds.length === 0 : allItemIds.length <= 1
            }
            title="Next Media (Right Arrow)"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>

          {isDynamic && (
            <button
              type="button"
              className={styles.controlBtn}
              onClick={handleNextPost}
              disabled={allPostIds.length <= 1}
              title="Next Post (PageDown / Up Arrow)"
            >
              <ChevronsRight size={18} />
            </button>
          )}
        </div>

        <div className={styles.separator} />

        <div className={styles.controlGroup}>
          <button
            type="button"
            className={`${styles.controlBtn} ${repeat ? styles.controlBtnActive : ""}`}
            onClick={() => setRepeat(!repeat)}
            title={repeat ? "Repeat: ON (R)" : "Repeat: OFF (R)"}
          >
            <Repeat size={18} />
          </button>

          <button
            type="button"
            className={`${styles.controlBtn} ${shuffle ? styles.controlBtnActive : ""}`}
            onClick={handleToggleShuffle}
            title={shuffle ? "Shuffle: ON (S)" : "Shuffle: OFF (S)"}
          >
            <Shuffle size={18} />
          </button>

          <button
            type="button"
            className={styles.controlBtn}
            disabled
            title="Multiview (Disabled)"
          >
            <Maximize size={18} />
          </button>
        </div>

        <div className={styles.separator} />

        <div className={styles.progressInfo}>
          {isDynamic
            ? `Post ${activePostIndex + 1} / ${allPostIds.length} · Media ${currentMediaIndex + 1} / ${currentPostMedia.length || 1}`
            : `${shuffle ? shuffleCursor + 1 : currentIndex + 1} / ${allItemIds.length}`}
        </div>
      </div>
    </div>
  );
}

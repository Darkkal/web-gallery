"use client";

import {
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
import type { PlaylistWithItems } from "@/types/playlist";

interface PlaylistPlayerPageClientProps {
  initialPlaylist: PlaylistWithItems;
}

export default function PlaylistPlayerPageClient({
  initialPlaylist,
}: PlaylistPlayerPageClientProps) {
  const router = useRouter();
  const playlist = initialPlaylist;
  const items = playlist.items;

  // Player State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [shuffleCursor, setShuffleCursor] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const [_viewMode, _setViewMode] = useState<"single" | "multi">("single"); // Stub for future multiview
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls on mouse/touch inactivity
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

  // Reset controls timeout when hovering state changes
  useEffect(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Fisher-Yates Shuffle generator
  const enableShuffle = useCallback(
    (startIndex: number, isLoopTransition = false) => {
      const indices = Array.from({ length: items.length }, (_, i) => i);
      // Shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      if (isLoopTransition) {
        // Guarantee that the first item of the new shuffle is NOT the last played item
        if (indices[0] === startIndex && indices.length > 1) {
          const j = Math.floor(Math.random() * (indices.length - 1)) + 1;
          [indices[0], indices[j]] = [indices[j], indices[0]];
        }
      } else {
        // Put current index at the front so it doesn't change on click
        const currentIdxInShuffled = indices.indexOf(startIndex);
        if (currentIdxInShuffled !== -1) {
          indices.splice(currentIdxInShuffled, 1);
          indices.unshift(startIndex);
        }
      }

      setShuffledIndices(indices);
      setShuffleCursor(0);
    },
    [items.length],
  );

  // Toggle Shuffle
  const handleToggleShuffle = useCallback(() => {
    if (!shuffle) {
      enableShuffle(currentIndex);
      setShuffle(true);
    } else {
      setShuffle(false);
    }
  }, [shuffle, enableShuffle, currentIndex]);

  const currentPlaylistItem =
    shuffle && shuffledIndices.length === items.length
      ? items[shuffledIndices[shuffleCursor]]
      : items[currentIndex];

  const currentMedia = currentPlaylistItem?.mediaItem;
  const isVideo = currentMedia?.mediaType === "video";

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;

    if (shuffle && shuffledIndices.length === items.length) {
      const nextCursor = shuffleCursor + 1;
      if (nextCursor < items.length) {
        setShuffleCursor(nextCursor);
      } else if (repeat) {
        // Regenerate new shuffle order on loop
        enableShuffle(shuffledIndices[shuffleCursor], true);
      } else {
        setIsPlaying(false);
      }
    } else {
      const nextIndex = currentIndex + 1;
      if (nextIndex < items.length) {
        setCurrentIndex(nextIndex);
      } else if (repeat) {
        setCurrentIndex(0);
      } else {
        setIsPlaying(false);
      }
    }
  }, [
    items.length,
    shuffle,
    shuffledIndices,
    shuffleCursor,
    repeat,
    currentIndex,
    enableShuffle,
  ]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;

    if (shuffle && shuffledIndices.length === items.length) {
      const prevCursor = shuffleCursor - 1;
      if (prevCursor >= 0) {
        setShuffleCursor(prevCursor);
      } else if (repeat) {
        setShuffleCursor(items.length - 1);
      }
    } else {
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        setCurrentIndex(prevIndex);
      } else if (repeat) {
        setCurrentIndex(items.length - 1);
      }
    }
  }, [
    items.length,
    shuffle,
    shuffledIndices,
    shuffleCursor,
    repeat,
    currentIndex,
  ]);

  // Synchronize currentIndex with shuffleCursor when items change
  useEffect(() => {
    if (shuffle && shuffledIndices.length === items.length) {
      setCurrentIndex(shuffledIndices[shuffleCursor]);
    }
  }, [shuffle, shuffledIndices, shuffleCursor, items.length]);

  // Autoplay handler for Mixed Media (images = 5s, videos = wait for end)
  useEffect(() => {
    if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    setProgress(0);

    if (!isPlaying || !currentPlaylistItem?.mediaItem) return;

    const media = currentPlaylistItem.mediaItem;

    if (media.mediaType === "video") {
      // Videos auto-advance onended trigger (set inside element)
      return;
    }

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
  }, [isPlaying, currentPlaylistItem, handleNext]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Sync HTML5 video play/pause with isPlaying state
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

  // Load video only when the active playlist item changes
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

  // Key listeners
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
    [handleNext, handlePrev, handleToggleShuffle, playlist.id, router],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!currentMedia) return null;

  const displayPosition = shuffle ? shuffleCursor + 1 : currentIndex + 1;
  const shouldShowControlsBar = showControls && !(isVideo && isPlaying);

  return (
    <div className={styles.playerContainer}>
      {/* Close button top-right */}
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

      {/* Main viewport */}
      <div className={styles.mediaWrapper}>
        {isVideo ? (
          // biome-ignore lint/a11y/useMediaCaption: User generated videos
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

      {/* Controls Bar Overlay */}
      <div
        className={`${styles.controlsBar} ${!shouldShowControlsBar ? styles.hidden : ""}`}
        onMouseEnter={() => setIsHoveringControls(true)}
        onMouseLeave={() => setIsHoveringControls(false)}
        role="toolbar"
        aria-label="Player controls"
      >
        {/* Sleek horizontal progress loader - images only */}
        {!isVideo && (
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        )}

        {/* Navigation actions */}
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={handlePrev}
            disabled={items.length <= 1}
            title="Previous (Left Arrow)"
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
            disabled={items.length <= 1}
            title="Next (Right Arrow)"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>
        </div>

        <div className={styles.separator} />

        {/* Playback Settings */}
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
            disabled // Disabled for follow-up multiview integration
            title="Multiview (Disabled)"
          >
            <Maximize size={18} />
          </button>
        </div>

        <div className={styles.separator} />

        {/* Playback Stats */}
        <div className={styles.progressInfo}>
          {displayPosition} / {items.length}
        </div>
      </div>
    </div>
  );
}

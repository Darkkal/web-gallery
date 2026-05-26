import { useEffect, useRef } from "react";

/**
 * A custom React hook that plays and pauses a video element automatically
 * based on its visibility in the viewport using the IntersectionObserver API.
 *
 * @param autoplayEnabled - Whether autoplay behavior is turned on
 * @param muteEnabled - Whether the video should be muted when played
 * @returns A React Ref to be attached to the <video> element
 */
export function useAutoplayVideo(
  autoplayEnabled: boolean,
  muteEnabled: boolean,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!autoplayEnabled) {
      return;
    }

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }

    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    // Set initial mute state
    videoElement.muted = muteEnabled;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Apply mute state right before playing
            videoElement.muted = muteEnabled;
            videoElement.play().catch((err: unknown) => {
              if (
                err instanceof Error &&
                err.name !== "AbortError" &&
                err.name !== "NotAllowedError"
              ) {
                console.error("[useAutoplayVideo] Playback failed:", err);
              }
            });
          } else {
            videoElement.pause();
          }
        }
      },
      {
        threshold: 0.5, // 50% or more visible
      },
    );

    observer.observe(videoElement);

    return () => {
      observer.unobserve(videoElement);
      observer.disconnect();
    };
  }, [autoplayEnabled, muteEnabled]);

  return videoRef;
}

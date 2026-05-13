import { useEffect, useRef, useCallback } from "react";

interface UseInfiniteScrollOptions {
  loadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

/**
 * Uses IntersectionObserver to trigger `loadMore` when a sentinel
 * element at the bottom of the feed scrolls into the viewport.
 *
 * Returns a ref callback to attach to the sentinel element.
 */
export function useInfiniteScroll({
  loadMore,
  hasMore,
  isLoading,
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Clean up previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node || !hasMore) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasMore && !isLoading) {
            loadMore();
          }
        },
        { rootMargin: "200px" },
      );

      observerRef.current.observe(node);
    },
    [loadMore, hasMore, isLoading],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { sentinelRef };
}

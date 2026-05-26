"use client";

import styles from "@/components/InfiniteScrollSentinel.module.css";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

interface InfiniteScrollSentinelProps {
  loadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  rootMargin?: string;
}

export default function InfiniteScrollSentinel({
  loadMore,
  hasMore,
  isLoading,
  rootMargin,
}: InfiniteScrollSentinelProps) {
  const { sentinelRef } = useInfiniteScroll({
    loadMore,
    hasMore,
    isLoading,
    rootMargin,
  });

  return (
    <div ref={sentinelRef} className={styles.sentinel}>
      {isLoading && <span className={styles.spinner}>Loading…</span>}
    </div>
  );
}

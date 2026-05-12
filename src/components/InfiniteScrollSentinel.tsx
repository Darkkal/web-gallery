'use client';

import React from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import styles from '@/components/InfiniteScrollSentinel.module.css';

interface InfiniteScrollSentinelProps {
    loadMore: () => void;
    hasMore: boolean;
    isLoading: boolean;
}

export default function InfiniteScrollSentinel({ loadMore, hasMore, isLoading }: InfiniteScrollSentinelProps) {
    const { sentinelRef } = useInfiniteScroll({ loadMore, hasMore, isLoading });

    return (
        <div ref={sentinelRef} className={styles.sentinel}>
            {isLoading && <span className={styles.spinner}>Loading…</span>}
        </div>
    );
}

'use client';

import React from 'react';
import { useScrollMode } from '@/hooks/useScrollMode';
import styles from '@/components/ScrollModeToggle.module.css';

export default function ScrollModeToggle() {
    const { scrollMode, setScrollMode } = useScrollMode();

    return (
        <div className={styles.toggle}>
            <button
                className={`${styles.option} ${scrollMode === 'infinite' ? styles.active : ''}`}
                onClick={() => setScrollMode('infinite')}
                title="Infinite Scroll"
                aria-label="Use infinite scroll"
            >
                ↕
            </button>
            <button
                className={`${styles.option} ${scrollMode === 'button' ? styles.active : ''}`}
                onClick={() => setScrollMode('button')}
                title="Load More Button"
                aria-label="Use load more button"
            >
                …
            </button>
        </div>
    );
}

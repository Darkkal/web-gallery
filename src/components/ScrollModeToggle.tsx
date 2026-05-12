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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" />
                </svg>
            </button>
            <button
                className={`${styles.option} ${scrollMode === 'button' ? styles.active : ''}`}
                onClick={() => setScrollMode('button')}
                title="Paginate manually"
                aria-label="Paginate manually"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 6h12M2 10h12" />
                </svg>
            </button>
        </div>
    );
}

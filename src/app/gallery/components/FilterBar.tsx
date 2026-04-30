'use client';

import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import styles from '../page.module.css';

interface FilterBarProps {
    selectionMode: boolean;
    setSelectionMode: (mode: boolean) => void;
    onSelectAll: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    sortBy: string;
    setSortBy: (sort: string) => void;
    columnCount: number;
    setColumnCount: (count: number) => void;
    onRefresh: () => void;
}

export default function FilterBar({
    selectionMode,
    setSelectionMode,
    onSelectAll,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    columnCount,
    setColumnCount,
    onRefresh
}: FilterBarProps) {
    return (
        <div className={styles.filterBar}>
            <button
                className={selectionMode ? styles.activeButton : styles.secondaryButton}
                onClick={() => setSelectionMode(!selectionMode)}
                title={selectionMode ? 'Cancel Selection' : 'Select Items'}
                style={{ padding: '0.4rem', lineHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                {selectionMode ? <CheckSquare size={20} /> : <Square size={20} />}
            </button>

            {selectionMode && (
                <button
                    className={styles.secondaryButton}
                    onClick={onSelectAll}
                    title="Select All"
                >
                    Select All
                </button>
            )}

            <div className={styles.separator} />

            <input
                type="text"
                placeholder="Search (e.g. source:pixiv, min_favs:100, tag)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onRefresh()}
                className={styles.input}
                style={{ flex: 2 }}
            />
            <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className={styles.input}
            >
                <option value="created-desc">Imported: Newest First</option>
                <option value="created-asc">Oldest First</option>
                <option value="captured-desc">Content Date: Newest First</option>
                <option value="captured-asc">Content Date: Oldest First</option>
            </select>
            <div className={styles.separator} />
            <div className={styles.sliderContainer}>
                <label htmlFor="columns" className={styles.label}>Columns: {columnCount}</label>
                <input
                    id="columns"
                    type="range"
                    min="1"
                    max="10"
                    value={columnCount}
                    onChange={e => setColumnCount(parseInt(e.target.value))}
                    className={styles.slider}
                />
            </div>
        </div>
    );
}

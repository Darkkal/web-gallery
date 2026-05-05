'use client';

import React from 'react';
import styles from '../page.module.css';

interface FilterBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    sortBy: string;
    setSortBy: (sort: string) => void;
}

export default function FilterBar({
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy
}: FilterBarProps) {
    return (
        <div className={styles.filterBar}>
            <input
                type="text"
                placeholder="Search timeline (e.g. source:twitter)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={styles.input}
                style={{ flex: 1 }}
            />
            <div className={styles.separator} />
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
        </div>
    );
}

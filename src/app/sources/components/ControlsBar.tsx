'use client';

import React from 'react';
import { Search, Trash2, LayoutGrid, List as ListIcon } from 'lucide-react';
import styles from '../page.module.css';

interface ControlsBarProps {
  search: string;
  setSearch: (s: string) => void;
  sortBy: 'created' | 'name';
  setSortBy: (s: 'created' | 'name') => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  viewMode: 'card' | 'table';
  setViewMode: (m: 'card' | 'table') => void;
}

export default function ControlsBar({
  search,
  setSearch,
  sortBy,
  setSortBy,
  selectedCount,
  onDeleteSelected,
  viewMode,
  setViewMode
}: ControlsBarProps) {
  return (
    <div className={styles.controlsBar}>
      <div className={styles.leftControls}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.select}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'created' | 'name')}
        >
          <option value="created">Recently Added</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      <div className={styles.rightControls}>
        {selectedCount > 0 && (
          <button
            className={styles.deleteButton}
            onClick={onDeleteSelected}
          >
            <Trash2 size={18} />
            Delete ({selectedCount})
          </button>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`${styles.actionButton} ${viewMode === 'card' ? styles.active : ''}`}
            onClick={() => setViewMode('card')}
            title="Grid View"
          >
            <LayoutGrid size={20} />
          </button>
          <button
            className={`${styles.actionButton} ${viewMode === 'table' ? styles.active : ''}`}
            onClick={() => setViewMode('table')}
            title="List View"
          >
            <ListIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

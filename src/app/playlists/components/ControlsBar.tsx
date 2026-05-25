"use client";

import {
  LayoutGrid,
  List as ListIcon,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import styles from "@/app/playlists/page.module.css";

interface ControlsBarProps {
  search: string;
  setSearch: (s: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  viewMode: "card" | "table";
  setViewMode: (m: "card" | "table") => void;
  onCreatePlaylist: () => void;
}

export default function ControlsBar({
  search,
  setSearch,
  sortBy,
  setSortBy,
  selectedCount,
  onDeleteSelected,
  viewMode,
  setViewMode,
  onCreatePlaylist,
}: ControlsBarProps) {
  return (
    <div className={styles.controlsBar}>
      <div className={styles.leftControls}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search playlists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.select}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort playlists by"
        >
          <option value="updated-desc">Recently Updated</option>
          <option value="created-desc">Newest Created</option>
          <option value="created-asc">Oldest Created</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="count-desc">Most Items</option>
          <option value="count-asc">Least Items</option>
        </select>
      </div>

      <div className={styles.rightControls}>
        {selectedCount > 0 ? (
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onDeleteSelected}
          >
            <Trash2 size={18} />
            Delete ({selectedCount})
          </button>
        ) : (
          <button
            type="button"
            className={styles.createButton}
            onClick={onCreatePlaylist}
          >
            <Plus size={18} />
            Create Playlist
          </button>
        )}

        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.actionButton} ${viewMode === "card" ? styles.active : ""}`}
            onClick={() => setViewMode("card")}
            title="Grid View"
          >
            <LayoutGrid size={20} />
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${viewMode === "table" ? styles.active : ""}`}
            onClick={() => setViewMode("table")}
            title="List View"
          >
            <ListIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

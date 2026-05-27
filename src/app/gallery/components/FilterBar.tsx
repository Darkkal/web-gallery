"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Minus,
  Plus,
  Square,
} from "lucide-react";
import styles from "@/app/gallery/page.module.css";

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
  onRefresh,
}: FilterBarProps) {
  // Parse field and direction from sortBy state
  const isRelevance = sortBy === "relevance";
  const currentField = isRelevance ? "relevance" : sortBy.split("-")[0];
  const currentDir = isRelevance
    ? "desc"
    : sortBy.endsWith("-asc")
      ? "asc"
      : "desc";

  const handleFieldChange = (newField: string) => {
    if (newField === "relevance") {
      setSortBy("relevance");
    } else {
      setSortBy(`${newField}-${currentDir}`);
    }
  };

  const handleDirToggle = () => {
    if (isRelevance) return;
    const nextDir = currentDir === "desc" ? "asc" : "desc";
    setSortBy(`${currentField}-${nextDir}`);
  };

  return (
    <div className={styles.filterBar}>
      <button
        type="button"
        className={selectionMode ? styles.activeButton : styles.secondaryButton}
        onClick={() => setSelectionMode(!selectionMode)}
        title={selectionMode ? "Cancel Selection" : "Select Items"}
      >
        {selectionMode ? <CheckSquare size={20} /> : <Square size={20} />}
      </button>

      {selectionMode && (
        <button
          type="button"
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
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onRefresh()}
        className={`${styles.input} ${styles.searchInput}`}
      />
      <div className={styles.sortGroup}>
        <select
          value={currentField}
          onChange={(e) => handleFieldChange(e.target.value)}
          className={styles.input}
        >
          <option value="created">Imported to Library</option>
          <option value="captured">Original Post Date</option>
          <option value="relevance" disabled={searchQuery.trim().length === 0}>
            Relevance (Search Only)
          </option>
        </select>
        <button
          type="button"
          className={styles.iconButton}
          onClick={handleDirToggle}
          disabled={isRelevance}
          title={
            isRelevance
              ? "Sorting by relevance does not support direction"
              : currentDir === "desc"
                ? "Sort Ascending (Oldest First)"
                : "Sort Descending (Newest First)"
          }
          aria-label="Toggle sort direction"
        >
          {currentDir === "desc" ? (
            <ArrowDown size={18} />
          ) : (
            <ArrowUp size={18} />
          )}
        </button>
      </div>
      <div className={styles.separator} />
      <div className={styles.columnControl}>
        <span className={styles.label}>Columns: {columnCount}</span>
        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setColumnCount(Math.max(1, columnCount - 1))}
            disabled={columnCount <= 1}
            title="Decrease Columns"
            aria-label="Decrease columns count"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setColumnCount(Math.min(10, columnCount + 1))}
            disabled={columnCount >= 10}
            title="Increase Columns"
            aria-label="Increase columns count"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

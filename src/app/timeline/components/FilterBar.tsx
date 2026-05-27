"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import styles from "@/app/timeline/page.module.css";

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
  setSortBy,
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
      <input
        type="text"
        placeholder="Search timeline (e.g. source:twitter)..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={`${styles.input} ${styles.searchInput}`}
      />
      <div className={styles.separator} />
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
  );
}

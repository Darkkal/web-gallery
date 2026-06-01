"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Loader2,
  Minus,
  Plus,
  Square,
} from "lucide-react";
import { useEffect } from "react";
import styles from "@/app/gallery/page.module.css";
import { AutocompleteDropdown } from "@/components/AutocompleteDropdown";
import dropdownStyles from "@/components/AutocompleteDropdown.module.css";
import { useSearchAutocomplete } from "@/hooks/useSearchAutocomplete";

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
  onSuppressSearch?: (suppress: boolean) => void;
  isSearching?: boolean;
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
  onSuppressSearch,
  isSearching = false,
}: FilterBarProps) {
  const {
    suggestions,
    selectedIndex,
    isOpen,
    inputRef,
    handleKeyDown,
    acceptSuggestion,
    shouldSuppressSearch,
  } = useSearchAutocomplete(searchQuery, setSearchQuery);

  useEffect(() => {
    if (onSuppressSearch) {
      onSuppressSearch(shouldSuppressSearch);
    }
  }, [shouldSuppressSearch, onSuppressSearch]);

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

      <div style={{ position: "relative", flex: 2, display: "flex" }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search (e.g. tag:landscape, extractor:pixiv)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            handleKeyDown(e);
            if (e.key === "Enter" && !isOpen) {
              onRefresh();
            }
          }}
          className={`${styles.input} ${styles.searchInput}`}
          style={{ width: "100%", paddingRight: isSearching ? "36px" : "12px" }}
          aria-autocomplete="list"
          aria-controls={isOpen ? "search-autocomplete-listbox" : undefined}
          aria-expanded={isOpen}
          role="combobox"
          aria-activedescendant={
            isOpen ? `suggestion-item-${selectedIndex}` : undefined
          }
        />
        {isSearching && (
          <div
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "hsl(var(--muted-foreground))",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <Loader2 className={dropdownStyles.spinner} size={18} />
          </div>
        )}
        {isOpen && (
          <AutocompleteDropdown
            suggestions={suggestions}
            selectedIndex={selectedIndex}
            onSelect={acceptSuggestion}
          />
        )}
      </div>
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

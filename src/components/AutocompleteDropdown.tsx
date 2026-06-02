import type React from "react";
import { useEffect, useRef } from "react";
import type { AutocompleteSuggestion } from "@/types/autocomplete";
import styles from "./AutocompleteDropdown.module.css";

interface AutocompleteDropdownProps {
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  isLoading?: boolean;
}

export const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll into view when selectedIndex changes
  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector(
      `[data-active="true"]`,
    ) as HTMLElement;

    if (activeEl) {
      activeEl.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
    }
  }, [selectedIndex]);

  if (suggestions.length === 0 && !isLoading) return null;

  return (
    <div
      ref={containerRef}
      className={styles.autocompleteDropdown}
      role="listbox"
      id="search-autocomplete-listbox"
      aria-label="Search suggestions"
    >
      {suggestions.length === 0 && isLoading && (
        <div className={styles.loadingContainer}>
          <svg
            className={styles.spinner}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Loading suggestions...</title>
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="30 30"
              opacity="0.25"
            />
            <path
              d="M12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.0434 16.4523"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.loadingText}>Loading suggestions...</span>
        </div>
      )}

      {suggestions.length > 0 && isLoading && (
        <div className={styles.topRightSpinnerContainer}>
          <svg
            className={styles.spinner}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Loading...</title>
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="30 30"
              opacity="0.25"
            />
            <path
              d="M12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.0434 16.4523"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {suggestions.map((suggestion, index) => {
        const isActive = index === selectedIndex;
        return (
          <div
            key={`${suggestion.type}-${suggestion.value}`}
            className={styles.suggestionItem}
            data-active={isActive}
            onClick={() => onSelect(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(index);
              }
            }}
            role="option"
            aria-selected={isActive}
            id={`suggestion-item-${index}`}
            tabIndex={-1}
          >
            {suggestion.type === "column" && suggestion.icon && (
              <span className={styles.suggestionIcon} aria-hidden="true">
                {suggestion.icon}
              </span>
            )}

            <div className={styles.suggestionTextContainer}>
              <span className={styles.suggestionLabel}>{suggestion.label}</span>
              {suggestion.description && (
                <span className={styles.suggestionDescription}>
                  {suggestion.description}
                </span>
              )}
            </div>

            {suggestion.count !== undefined && (
              <span className={styles.suggestionCount}>
                {suggestion.count} {suggestion.count === 1 ? "post" : "posts"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

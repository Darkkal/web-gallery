import { Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type {
  AutocompleteResponse,
  AutocompleteSuggestion,
} from "@/types/autocomplete";
import styles from "./TagAutocompleteInput.module.css";

interface TagAutocompleteInputProps {
  onTagSelected: (tagName: string, ancestors?: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeTags?: string[];
  className?: string;
}

export default function TagAutocompleteInput({
  onTagSelected,
  placeholder = "Add tag...",
  disabled = false,
  excludeTags = [],
  className = "",
}: TagAutocompleteInputProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch suggestions when debouncedQuery changes
  useEffect(() => {
    let active = true;
    if (debouncedQuery.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    async function fetchTags() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/autocomplete?column=tag&q=${encodeURIComponent(debouncedQuery.trim())}`,
        );
        if (!res.ok) throw new Error("Failed to fetch tags");
        const data: AutocompleteResponse = await res.json();

        if (active) {
          // Filter out excluded tags (case-insensitive)
          const filtered = data.suggestions.filter(
            (s) =>
              !excludeTags.some(
                (ex) => ex.toLowerCase() === s.value.toLowerCase(),
              ),
          );
          setSuggestions(filtered);
          setIsOpen(filtered.length > 0);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchTags();

    return () => {
      active = false;
    };
  }, [debouncedQuery, excludeTags]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (tagName: string, ancestors?: string[]) => {
    if (tagName.trim()) {
      onTagSelected(tagName.trim(), ancestors);
      setQuery("");
      setSuggestions([]);
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Crucial: stop propagation to prevent lightbox from closing or shifting slides
    e.stopPropagation();

    if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      setIsOpen(true);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setSelectedIndex(
        (prev) => (prev - 1 + suggestions.length) % suggestions.length,
      );
      setIsOpen(true);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelect(
          suggestions[selectedIndex].value,
          suggestions[selectedIndex].ancestors,
        );
      } else if (query.trim()) {
        handleSelect(query);
      }
    }
  };

  return (
    <div ref={containerRef} className={`${styles.wrapper} ${className}`}>
      <div className={styles.inputContainer}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => e.stopPropagation()} // Stop keyup propagation as well
          placeholder={placeholder}
          disabled={disabled}
          className={styles.input}
        />
        {isLoading && (
          <div className={styles.spinnerWrapper}>
            <Loader2 className={styles.spinner} size={16} />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className={styles.dropdown} role="listbox">
          {suggestions.map((suggestion, index) => {
            const isActive = index === selectedIndex;
            return (
              <div
                key={suggestion.value}
                className={styles.dropdownItem}
                data-active={isActive}
                onClick={() =>
                  handleSelect(suggestion.value, suggestion.ancestors)
                }
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    handleSelect(suggestion.value, suggestion.ancestors);
                  }
                }}
                role="option"
                aria-selected={isActive}
                tabIndex={-1}
              >
                <span className={styles.tagLabel}>{suggestion.label}</span>
                {suggestion.count !== undefined && (
                  <span className={styles.tagCount}>
                    {suggestion.count}{" "}
                    {suggestion.count === 1 ? "post" : "posts"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

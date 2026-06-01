import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SEARCH_COLUMNS } from "@/lib/utils/search-parser";
import type {
  AutocompleteResponse,
  AutocompleteSuggestion,
} from "@/types/autocomplete";

export function useSearchAutocomplete(
  value: string,
  onChange: (newValue: string) => void,
) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [phase, setPhase] = useState<"column" | "value">("column");
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  // Track raw value query for value phase, which we'll debounce
  const [valueQuery, setValueQuery] = useState<string>("");
  const debouncedValueQuery = useDebouncedValue(valueQuery, 200);

  const inputRef = useRef<HTMLInputElement>(null);

  // Parse word at current cursor position
  const getWordAtCursor = (text: string, cursorOffset: number) => {
    const beforeCursor = text.slice(0, cursorOffset);
    const afterCursor = text.slice(cursorOffset);

    const lastSpaceBefore = beforeCursor.lastIndexOf(" ");
    const start = lastSpaceBefore === -1 ? 0 : lastSpaceBefore + 1;

    const firstSpaceAfter = afterCursor.indexOf(" ");
    const end =
      firstSpaceAfter === -1 ? text.length : cursorOffset + firstSpaceAfter;

    const word = text.slice(start, end);
    return { word, start, end };
  };

  const recalculate = () => {
    if (!inputRef.current) return;
    const input = inputRef.current;
    const text = input.value;
    const cursorOffset = input.selectionStart ?? 0;

    const { word } = getWordAtCursor(text, cursorOffset);

    // If word has a colon, we are in 'value' phase
    const colonIndex = word.indexOf(":");
    if (colonIndex !== -1) {
      const colPrefix = word.slice(0, colonIndex).toLowerCase();
      const valQuery = word.slice(colonIndex + 1);

      // Check if it's a valid column alias
      const isValidColumn = SEARCH_COLUMNS.some(
        (c) => c.alias.toLowerCase() === `${colPrefix}:`,
      );

      if (isValidColumn) {
        setPhase("value");
        setActiveColumn(colPrefix);
        setValueQuery(valQuery);
        setIsOpen(true);
        return;
      }
    }

    // Otherwise, we are in 'column' phase
    setPhase("column");
    setActiveColumn(null);
    setValueQuery("");

    // Show column suggestions matching current typed word (if any)
    if (word && !word.includes(":")) {
      const filtered = SEARCH_COLUMNS.filter((c) =>
        c.alias.toLowerCase().startsWith(word.toLowerCase()),
      ).map((c) => ({
        value: c.alias,
        label: c.alias,
        description: c.description,
        icon: c.icon,
        type: "column" as const,
      }));

      if (filtered.length > 0) {
        setSuggestions(filtered);
        setIsOpen(true);
        setSelectedIndex(0);
        return;
      }
    }

    // Default to closed if no matching columns/values
    setSuggestions([]);
    setIsOpen(false);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: recalculate on value changes
  useEffect(() => {
    recalculate();
  }, [value]);

  // Fetch value suggestions when activeColumn or debouncedValueQuery changes
  useEffect(() => {
    if (phase !== "value" || !activeColumn) return;

    const col = activeColumn;
    let active = true;

    async function fetchValueSuggestions() {
      try {
        const res = await fetch(
          `/api/autocomplete?column=${encodeURIComponent(
            col,
          )}&q=${encodeURIComponent(debouncedValueQuery)}`,
        );
        if (!res.ok)
          throw new Error("Failed to fetch autocomplete suggestions");
        const data: AutocompleteResponse = await res.json();

        if (active) {
          setSuggestions(data.suggestions);
          setSelectedIndex(0);
          setIsOpen(data.suggestions.length > 0);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setSuggestions([]);
          setIsOpen(false);
        }
      }
    }

    fetchValueSuggestions();

    return () => {
      active = false;
    };
  }, [phase, activeColumn, debouncedValueQuery]);

  const acceptSuggestion = (index: number) => {
    const suggestion = suggestions[index];
    if (!suggestion || !inputRef.current) return;

    const input = inputRef.current;
    const text = input.value;
    const cursorOffset = input.selectionStart ?? 0;
    const { start, end } = getWordAtCursor(text, cursorOffset);

    let replacement = "";
    let newCursorPos = 0;

    if (suggestion.type === "column") {
      replacement = suggestion.value; // e.g., "tag:"
      newCursorPos = start + replacement.length;
    } else {
      // Value suggestion: preserve the column prefix
      const currentWord = text.slice(start, end);
      const colonIdx = currentWord.indexOf(":");
      const columnPrefix =
        colonIdx !== -1 ? currentWord.slice(0, colonIdx + 1) : "";

      replacement = `${columnPrefix}${suggestion.value} `;
      newCursorPos = start + replacement.length;
    }

    const newText = text.slice(0, start) + replacement + text.slice(end);
    onChange(newText);

    // Reposition cursor on next tick
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        recalculate();
      }
    }, 0);

    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        );
        break;
      case "Enter":
      case "Tab":
        e.preventDefault();
        acceptSuggestion(selectedIndex);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case " ":
        if (phase === "column") {
          // Close dropdown on space key press in column phase to allow normal typing
          setIsOpen(false);
        }
        break;
    }
  };

  return {
    suggestions,
    selectedIndex,
    isOpen,
    phase,
    inputRef,
    handleKeyDown,
    acceptSuggestion,
    shouldSuppressSearch: isOpen,
    recalculate,
    setIsOpen,
  };
}

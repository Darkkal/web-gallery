export interface AutocompleteSuggestion {
  value: string; // The text to insert (e.g., "landscape" or "tag:")
  label: string; // Display text
  description?: string; // Secondary text (e.g., "Filter by tag name")
  count?: number; // Post count for value suggestions
  icon?: string; // Emoji icon for column suggestions
  type: "column" | "value";
  ancestors?: string[];
}

export interface AutocompleteResponse {
  suggestions: AutocompleteSuggestion[];
}

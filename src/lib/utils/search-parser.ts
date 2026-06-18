export interface ParsedSearchQuery {
  cleanQuery: string;
  sourceFilter: string | null;
}

export interface SearchFilterColumn {
  alias: string;
  name: string;
  icon: string;
  description: string;
  type: "dynamic" | "static";
}

export const SEARCH_COLUMNS: SearchFilterColumn[] = [
  {
    alias: "tag:",
    name: "Tag",
    icon: "🏷️",
    description: "Filter by tag name",
    type: "dynamic",
  },
  {
    alias: "user:",
    name: "User",
    icon: "👤",
    description: "Filter by username",
    type: "dynamic",
  },
  {
    alias: "handle:",
    name: "Handle",
    icon: "@",
    description: "Filter by user handle",
    type: "dynamic",
  },
  {
    alias: "title:",
    name: "Title",
    icon: "📝",
    description: "Filter by post title",
    type: "dynamic",
  },
  {
    alias: "content:",
    name: "Content",
    icon: "📄",
    description: "Filter by post content",
    type: "dynamic",
  },
  {
    alias: "source:",
    name: "Source",
    icon: "🔗",
    description: "Filter by extractor type",
    type: "static",
  },
  {
    alias: "extractor:",
    name: "Extractor",
    icon: "⚙️",
    description: "Filter by extractor type",
    type: "static",
  },
];

export const ftsColumnAliases: Record<string, string> = {
  tag: "tag_names",
  tag_names: "tag_names",
  user: "user_name",
  user_name: "user_name",
  handle: "user_handle",
  user_handle: "user_handle",
  title: "title",
  content: "content",
  source_name: "source_name",
};

export function parseSearchQuery(search: string = ""): ParsedSearchQuery {
  // Strip trailing incomplete column prefixes like "tag:", "user:", "source:", etc. at the end of the query
  const trailingPrefixRegex =
    /\b(?:tag|user|handle|title|content|source|extractor):\s*$/i;
  let cleanQuery = search.replace(trailingPrefixRegex, "").trim();

  let sourceFilter: string | null = null;
  // Match either "source:xyz" or "extractor:xyz"
  const sourceMatch = cleanQuery.match(
    /(?:source|extractor):([a-zA-Z0-9_-]+)/i,
  );
  if (sourceMatch) {
    sourceFilter = sourceMatch[1].toLowerCase();
    cleanQuery = cleanQuery.replace(sourceMatch[0], "").trim();
  }

  const validFtsColumns = new Set(Object.values(ftsColumnAliases));

  // Map friendly aliases to exact FTS5 column names
  cleanQuery = cleanQuery.replace(/\b([a-zA-Z0-9_]+):/gi, (match, prefix) => {
    const lowerPrefix = prefix.toLowerCase();
    if (ftsColumnAliases[lowerPrefix]) {
      return `${ftsColumnAliases[lowerPrefix]}:`;
    }
    return match;
  });

  // FTS5 syntax safety: remove characters that could cause SQLite parse errors if unbalanced/misused
  // Preserves letters, numbers, spaces, colons (for column filters), and underscores.
  cleanQuery = cleanQuery
    .replace(/[^\p{L}\p{N}\s:_]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Prevent FTS5 "no such column" crashes: strip colons if they don't match a valid FTS5 column
  cleanQuery = cleanQuery.replace(/([a-zA-Z0-9_]+):/g, (match, colName) => {
    if (validFtsColumns.has(colName.toLowerCase())) {
      return match;
    }
    return `${colName} `; // Convert to standard text search by removing the colon
  });

  return { cleanQuery, sourceFilter };
}

export function saveFiltersToHistory(query: string) {
  if (typeof window === "undefined") return;
  const filterMatches = query.match(/\b([a-zA-Z0-9_]+):([a-zA-Z0-9_-]+)/g);
  if (!filterMatches) return;

  try {
    const historyJson = localStorage.getItem("webgallery_search_history");
    let history: string[] = historyJson ? JSON.parse(historyJson) : [];

    for (const filter of filterMatches) {
      const lowerFilter = filter.toLowerCase();
      // Remove duplicate if it already exists
      history = history.filter((x) => x.toLowerCase() !== lowerFilter);
      // Prepend to top
      history.unshift(filter);
    }

    // Cap at 30 items
    history = history.slice(0, 30);
    localStorage.setItem("webgallery_search_history", JSON.stringify(history));
  } catch (err) {
    console.error("Failed to save search history:", err);
  }
}

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
  let cleanQuery = search;

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
  cleanQuery = cleanQuery
    .replace(/[()"{}^*-]/g, " ")
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

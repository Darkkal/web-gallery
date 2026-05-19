export interface ParsedSearchQuery {
  cleanQuery: string;
  sourceFilter: string | null;
}

export function parseSearchQuery(search: string = ""): ParsedSearchQuery {
  let cleanQuery = search;

  let sourceFilter: string | null = null;
  const sourceMatch = cleanQuery.match(/source:([a-zA-Z0-9_-]+)/i);
  if (sourceMatch) {
    sourceFilter = sourceMatch[1].toLowerCase();
    cleanQuery = cleanQuery.replace(sourceMatch[0], "").trim();
  }

  // Define friendly aliases mapping to actual FTS5 virtual table column names
  const ftsColumnAliases: Record<string, string> = {
    tag: "tag_names",
    tag_names: "tag_names",
    user: "user_name",
    user_name: "user_name",
    handle: "user_handle",
    user_handle: "user_handle",
    title: "title",
    content: "content",
    source_name: "source_name",
    // Add future extractor mappings here
  };

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

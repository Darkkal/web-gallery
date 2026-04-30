export interface ParsedSearchQuery {
    cleanQuery: string;
    sourceFilter: string | null;
}

export function parseSearchQuery(search: string = ''): ParsedSearchQuery {
    let cleanQuery = search;

    let sourceFilter: string | null = null;
    const sourceMatch = cleanQuery.match(/source:([a-zA-Z0-9_-]+)/i);
    if (sourceMatch) {
        sourceFilter = sourceMatch[1].toLowerCase();
        cleanQuery = cleanQuery.replace(sourceMatch[0], '').trim();
    }

    return { cleanQuery, sourceFilter };
}

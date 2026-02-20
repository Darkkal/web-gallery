export interface ParsedSearchQuery {
    cleanQuery: string;
    minFavorites: number;
    sourceFilter: string | null;
}

export function parseSearchQuery(search: string = ''): ParsedSearchQuery {
    let cleanQuery = search;
    let minFavorites = 0;

    const favsMatch = cleanQuery.match(/(?:favs|min_favs):(\d+)/i);
    if (favsMatch) {
        minFavorites = parseInt(favsMatch[1], 10);
        cleanQuery = cleanQuery.replace(favsMatch[0], '').trim();
    }

    let sourceFilter: string | null = null;
    const sourceMatch = cleanQuery.match(/source:([a-zA-Z0-9_-]+)/i);
    if (sourceMatch) {
        sourceFilter = sourceMatch[1].toLowerCase();
        cleanQuery = cleanQuery.replace(sourceMatch[0], '').trim();
    }

    return { cleanQuery, minFavorites, sourceFilter };
}

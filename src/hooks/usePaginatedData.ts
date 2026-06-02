"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface UsePaginatedDataOptions<T> {
  initialItems: T[];
  initialNextCursor: string | null;
  initialSearch: string;
  initialSort: string;
  fetchPath: string;
  /** Key inside the JSON response that holds the items array, e.g. 'posts' or 'items' */
  dataKey: string;
  pageSize?: number;
  debounceMs?: number;
  playlistId?: number;
  suppressSearch?: boolean;
}

export function usePaginatedData<T>({
  initialItems,
  initialNextCursor,
  initialSearch,
  initialSort,
  fetchPath,
  dataKey,
  pageSize = 20,
  debounceMs = 1000,
  playlistId,
  suppressSearch = false,
}: UsePaginatedDataOptions<T>) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState(initialSort);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [isLoading, setIsLoading] = useState(false);

  // Keep refs to current values to avoid callback recreation
  const cursorRef = useRef(nextCursor);
  cursorRef.current = nextCursor;

  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const sortByRef = useRef(sortBy);
  sortByRef.current = sortBy;

  const lastSearchedQueryRef = useRef(initialSearch);
  const lastSearchedSortRef = useRef(initialSort);

  const debouncedSearch = useDebouncedValue(searchQuery, debounceMs);
  const debouncedSort = useDebouncedValue(sortBy, debounceMs);

  // Fetch a fresh page (cursor=null) and replace all items
  const refresh = useCallback(async () => {
    setIsLoading(true);
    const queryToSearch = searchQueryRef.current;
    const sortToSearch = sortByRef.current;
    try {
      const params = new URLSearchParams({
        search: queryToSearch,
        sortBy: sortToSearch,
        limit: String(pageSize),
      });
      if (playlistId) {
        params.set("playlist", String(playlistId));
      }

      const res = await fetch(`${fetchPath}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data[dataKey]);
        setNextCursor(data.nextCursor);
        lastSearchedQueryRef.current = queryToSearch;
        lastSearchedSortRef.current = sortToSearch;
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchPath, dataKey, pageSize, playlistId]);

  // Append the next page using the current cursor
  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search: lastSearchedQueryRef.current,
        sortBy: lastSearchedSortRef.current,
        limit: String(pageSize),
        cursor,
      });
      if (playlistId) {
        params.set("playlist", String(playlistId));
      }

      const res = await fetch(`${fetchPath}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [...prev, ...data[dataKey]]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchPath, dataKey, pageSize, playlistId]);

  // Reset and re-fetch when search/sort changes
  const isFirstRender = useRef(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: run search on debounced search/sort changes or suppress changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (suppressSearch) {
      return;
    }
    // Only query if the query or sort has actually changed from what was last loaded
    if (
      searchQueryRef.current === lastSearchedQueryRef.current &&
      sortByRef.current === lastSearchedSortRef.current
    ) {
      return;
    }
    refresh();
  }, [refresh, debouncedSearch, debouncedSort, suppressSearch]);

  const isSearching = isLoading || searchQuery !== debouncedSearch;

  return {
    items,
    setItems,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    nextCursor,
    setNextCursor,
    isLoading,
    isSearching,
    loadMore,
    refresh,
    hasMore: nextCursor !== null,
  };
}

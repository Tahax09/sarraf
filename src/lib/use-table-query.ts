"use client";

import { useCallback, useEffect, useState } from "react";
import type { QueryParams } from "@/lib/api/client";
import { serializeSort, type SortState } from "@/lib/api/types";

/** Rows-per-page choices offered by every paginated register. */
export const PAGE_SIZES = [10, 20, 25, 50] as const;

export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/** Typing pause before a search reaches the API. */
const SEARCH_DEBOUNCE_MS = 300;

export type TableQuery = {
  page: number;
  pageSize: number;
  sort: SortState;
  /** Live input value — echo this back into the search box. */
  search: string;
  /**
   * Everything the request needs: paging, ordering, the debounced search term
   * and the caller's filters, ready to hand to a query hook.
   */
  params: QueryParams;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (sort: SortState) => void;
  setSearch: (value: string) => void;
};

export type TableQueryOptions = {
  pageSize?: number;
  sort?: SortState;
  /**
   * Page-owned filters. Changing any of them returns the reader to page 1 —
   * page 7 of the previous result set is meaningless against a new one.
   */
  filters?: QueryParams;
  /** Set false on a register with nothing to search. */
  searchable?: boolean;
};

/**
 * Owns the paging, ordering and search state of one register, and assembles the
 * query parameters the backend expects.
 *
 * State is held in memory rather than in the URL on purpose: a search term here
 * can be a client name or an account number, and the security baseline for this
 * panel keeps personal data out of query strings, browser history and referrer
 * headers. The cost is that a register's page is not linkable; that trade is
 * recorded in ADR-0003.
 */
export function useTableQuery({
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  sort: initialSort = null,
  filters,
  searchable = true,
}: TableQueryOptions = {}): TableQuery {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [sort, setSortState] = useState<SortState>(initialSort);
  const [search, setSearchState] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  // A new filter set, term, page size or ordering makes the current page number
  // meaningless. Reset during render so the request never fires for a page that
  // is about to be abandoned.
  const resetKey = JSON.stringify([
    filters ?? {},
    debouncedSearch,
    pageSize,
    sort,
  ]);
  const [seenResetKey, setSeenResetKey] = useState(resetKey);
  if (seenResetKey !== resetKey) {
    setSeenResetKey(resetKey);
    setPage(1);
  }

  const setPageSize = useCallback((size: number) => setPageSizeState(size), []);
  const setSort = useCallback((next: SortState) => setSortState(next), []);
  const setSearch = useCallback((value: string) => setSearchState(value), []);

  const params: QueryParams = {
    ...filters,
    page,
    pageSize,
    sort: serializeSort(sort),
    ...(searchable ? { q: debouncedSearch || undefined } : {}),
  };

  return {
    page,
    pageSize,
    sort,
    search,
    params,
    setPage,
    setPageSize,
    setSort,
    setSearch,
  };
}

/**
 * Next state for a header the reader activated: first click sorts ascending,
 * the second flips it, the third returns to the server's default order.
 */
export function nextSort(current: SortState, key: string): SortState {
  if (current?.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

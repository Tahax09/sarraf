import type { LucideIcon } from "lucide-react";

/**
 * Search model.
 *
 * The UI knows only these shapes. Today they are produced by fanning out over
 * the existing list endpoints (`createApiSearchService`); the day the backend
 * grows a `/search` endpoint, a second implementation of `SearchService` is the
 * whole change — no component touches a query hook or a fixture.
 */

/** Which register a hit came from. Drives grouping order and the group label. */
export type SearchCategory =
  | "clients"
  | "accounts"
  | "operations"
  | "pages";

/** Ranked, ordered list of the categories the palette renders. */
export const SEARCH_CATEGORIES: SearchCategory[] = [
  "clients",
  "accounts",
  "operations",
  "pages",
];

export type SearchResult = {
  /** Stable across renders; the palette keys and tracks selection by it. */
  id: string;
  category: SearchCategory;
  /** First line — the thing itself. */
  title: string;
  /** Second line: an account number, a phone, the parent register. */
  subtitle?: string;
  /** Trailing metadata, right-aligned: an amount, a date, a status. */
  meta?: string;
  /** Where activating the result takes the reader. */
  href: string;
  icon?: LucideIcon;
  /**
   * Relevance, higher first. Produced by the fuzzy matcher so a local page hit
   * and a remote record hit can be ranked against each other.
   */
  score: number;
  /**
   * Character offsets in `title` that matched, for highlighting. Empty when the
   * match came from a field other than the title.
   */
  matches: number[];
};

export type SearchGroup = {
  category: SearchCategory;
  results: SearchResult[];
};

/**
 * The seam between the palette and wherever results come from.
 *
 * `signal` aborts a request the reader has already typed past, so a slow
 * response can never overwrite a newer one.
 */
export type SearchService = {
  search(query: string, signal: AbortSignal): Promise<SearchResult[]>;
};

/** Below this the palette shows recent searches instead of running a query. */
export const MIN_QUERY_LENGTH = 2;

/** Per category, so one noisy register cannot crowd out the others. */
export const MAX_RESULTS_PER_CATEGORY = 5;

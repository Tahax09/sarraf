"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { formatAmount } from "@/lib/format";
import { createStringListStore } from "@/lib/local-store";
import { usePermission } from "@/lib/use-permission";
import { createApiSearchService } from "@/lib/search/api-service";
import {
  MIN_QUERY_LENGTH,
  SEARCH_CATEGORIES,
  type SearchGroup,
  type SearchResult,
  type SearchService,
} from "@/lib/search/types";

/** Typing pause before a query leaves the browser. */
const DEBOUNCE_MS = 200;

const RECENT_LIMIT = 5;

/**
 * Recent terms are the only search state that outlives the dialog. They are
 * kept out of the URL because a term here is routinely a client name or an
 * account number, and the panel's baseline keeps that out of query strings,
 * history and referrer headers (ADR-0003) — and out of `localStorage` for the
 * same reason, since a branch workstation is shared and a persisted list would
 * still be there for the next person to open the palette. Session scope holds
 * them for as long as the tab is open and no longer; they are also clearable
 * from the palette itself.
 */
const recentStore = createStringListStore("saraf.search.recent", "session");

const NO_RESULTS: SearchResult[] = [];

/** Results plus the term they answer — the pair is what makes staleness visible. */
type Settled = {
  term: string;
  results: SearchResult[];
  failed: boolean;
};

const NOTHING_SETTLED: Settled = {
  term: "",
  results: NO_RESULTS,
  failed: false,
};

type SearchState = {
  open: boolean;
  query: string;
  /** Grouped, ranked results for the settled query. */
  groups: SearchGroup[];
  /** Flat, in render order — what arrow keys walk. */
  flat: SearchResult[];
  loading: boolean;
  failed: boolean;
  /** Index into `flat`, or 0 when nothing is highlighted. */
  activeIndex: number;
  recent: string[];
  setOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
  setActiveIndex: (index: number) => void;
  moveActive: (delta: number) => void;
  /** Records a term as recent — call when a result is opened. */
  remember: (term: string) => void;
  clearRecent: () => void;
};

const SearchContext = createContext<SearchState | null>(null);

export function SearchProvider({
  children,
  /** Test seam: inject a stub service instead of hitting the API. */
  service: injected,
}: {
  children: ReactNode;
  service?: SearchService;
}) {
  const tNav = useTranslations("nav");
  const { can } = usePermission();

  const [open, setOpenState] = useState(false);
  const [query, setQueryState] = useState("");
  const [debounced, setDebounced] = useState("");
  const [settled, setSettled] = useState<Settled>(NOTHING_SETTLED);
  const [activeIndex, setActiveIndex] = useState(0);

  const recent = useSyncExternalStore(
    recentStore.subscribe,
    recentStore.getSnapshot,
    recentStore.getServerSnapshot,
  );

  const navLabel = useCallback((key: string) => tNav(key), [tNav]);
  const service = useMemo(
    () => injected ?? createApiSearchService({ navLabel, can, formatAmount }),
    [injected, navLabel, can],
  );

  useEffect(() => {
    if (query === debounced) return;
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, debounced]);

  const term = debounced.trim();
  // Below the minimum the palette shows recents, so there is nothing to fetch
  // and nothing to clear — the derivations below simply stop reading `settled`.
  const searching = term.length >= MIN_QUERY_LENGTH;

  const requestId = useRef(0);

  useEffect(() => {
    if (!searching) return;

    const controller = new AbortController();
    const id = (requestId.current += 1);

    service
      .search(term, controller.signal)
      .then((found) => {
        // A response the reader has already typed past must not land.
        if (id !== requestId.current) return;
        setSettled({ term, results: found, failed: false });
        setActiveIndex(0);
      })
      .catch(() => {
        if (id !== requestId.current || controller.signal.aborted) return;
        setSettled({ term, results: NO_RESULTS, failed: true });
      });

    return () => controller.abort();
  }, [term, searching, service]);

  // Derived rather than stored: `loading` is precisely "the settled results
  // answer a different question than the one on screen", which no separate flag
  // can get wrong.
  const answered = searching && settled.term === term;
  const loading = searching && !answered;
  const failed = answered && settled.failed;
  const results = answered ? settled.results : NO_RESULTS;

  const groups = useMemo<SearchGroup[]>(
    () =>
      SEARCH_CATEGORIES.map((category) => ({
        category,
        results: results
          .filter((result) => result.category === category)
          .sort((a, b) => b.score - a.score),
      })).filter((group) => group.results.length > 0),
    [results],
  );

  const flat = useMemo(
    () => groups.flatMap((group) => group.results),
    [groups],
  );

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) {
      // Closing forgets the question. Reopening to a stale result list would
      // invite acting on a record that has since moved.
      setQueryState("");
      setDebounced("");
      setSettled(NOTHING_SETTLED);
      setActiveIndex(0);
    }
  }, []);

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    setActiveIndex(0);
  }, []);

  const moveActive = useCallback(
    (delta: number) => {
      setActiveIndex((current) => {
        if (flat.length === 0) return 0;
        // Wraps, so Up from the first row lands on the last.
        return (current + delta + flat.length) % flat.length;
      });
    },
    [flat.length],
  );

  const remember = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) return;
      recentStore.set(
        [trimmed, ...recent.filter((entry) => entry !== trimmed)].slice(
          0,
          RECENT_LIMIT,
        ),
      );
    },
    [recent],
  );

  const clearRecent = useCallback(() => recentStore.set([]), []);

  const value: SearchState = {
    open,
    query,
    groups,
    flat,
    loading,
    failed,
    activeIndex,
    recent,
    setOpen,
    setQuery,
    setActiveIndex,
    moveActive,
    remember,
    clearRecent,
  };

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearch(): SearchState {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used inside a <SearchProvider>");
  }
  return context;
}

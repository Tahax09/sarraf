"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  createMemoryRecordStore,
  createRecordStore,
  type RecordStore,
} from "@/lib/local-store";
import type { QueryParams } from "@/lib/api/client";

/**
 * One declarative filter model for every register.
 *
 * A page describes what it can be filtered by; the hook owns the values and
 * turns them into request parameters, and `<FilterBar>` renders the controls,
 * the chips and the mobile drawer. Pages stopped hand-rolling a grid of selects
 * with their own "clear" button, which is how three of them ended up clearing
 * different things.
 *
 * Range filters carry two request parameters (`amountMin`/`amountMax`,
 * `dateFrom`/`dateTo`) under one definition, because that is how the backend
 * already takes them.
 */

export type FilterOption = { value: string; label: string };

export type FilterDef =
  | { key: string; type: "select"; label: string; options: FilterOption[] }
  | { key: string; type: "text"; label: string; placeholder?: string }
  /** Emits `${key}From` / `${key}To` as ISO dates. */
  | { key: string; type: "dateRange"; label: string }
  /** Emits `${key}Min` / `${key}Max` as plain numbers. */
  | { key: string; type: "amountRange"; label: string };

/** The request parameters one definition owns. */
export function filterKeys(def: FilterDef): string[] {
  switch (def.type) {
    case "dateRange":
      return [`${def.key}From`, `${def.key}To`];
    case "amountRange":
      return [`${def.key}Min`, `${def.key}Max`];
    default:
      return [def.key];
  }
}

export type FilterState = {
  values: Record<string, string>;
  /** Reads one request parameter — `""` when unset. */
  get: (key: string) => string;
  set: (key: string, value: string) => void;
  /** Clears every parameter belonging to one definition. */
  clear: (def: FilterDef) => void;
  clearAll: () => void;
  /** Non-empty values only, ready to hand to `useTableQuery({ filters })`. */
  params: QueryParams;
  /** How many definitions currently constrain the result set. */
  activeCount: number;
};

// One store per persistence key, so two components filtering the same register
// (the bar and a summary line, say) never drift apart.
const stores = new Map<string, RecordStore>();

function storeFor(persistKey: string | undefined): RecordStore {
  if (!persistKey) return createMemoryRecordStore();
  let store = stores.get(persistKey);
  if (!store) {
    store = createRecordStore(`saraf.filters.${persistKey}`);
    stores.set(persistKey, store);
  }
  return store;
}

export function useFilters(
  defs: FilterDef[],
  {
    /**
     * Stable id for the register. Given one, the selection survives navigating
     * away and back within the session — the operator who filtered to a branch,
     * opened a record and came back does not filter again.
     */
    persistKey,
  }: { persistKey?: string } = {},
): FilterState {
  const [store] = useState(() => storeFor(persistKey));
  const values = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const get = useCallback((key: string) => values[key] ?? "", [values]);

  const set = useCallback(
    (key: string, value: string) => {
      store.set({ ...values, [key]: value });
    },
    [store, values],
  );

  const clear = useCallback(
    (def: FilterDef) => {
      const next = { ...values };
      for (const key of filterKeys(def)) delete next[key];
      store.set(next);
    },
    [store, values],
  );

  const clearAll = useCallback(() => store.set({}), [store]);

  const params = useMemo(() => {
    const known = new Set(defs.flatMap(filterKeys));
    const entries = Object.entries(values).filter(
      // A definition removed from the page must stop constraining the request,
      // even if a stale session still holds its value.
      ([key, value]) => known.has(key) && value !== "",
    );
    return Object.fromEntries(entries) as QueryParams;
  }, [defs, values]);

  const activeCount = useMemo(
    () => defs.filter((def) => filterKeys(def).some((key) => values[key])).length,
    [defs, values],
  );

  return { values, get, set, clear, clearAll, params, activeCount };
}

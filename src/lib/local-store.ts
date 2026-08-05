/**
 * `useSyncExternalStore`-shaped views over one web-storage key.
 *
 * `localStorage` is an external system, so React should subscribe to it rather
 * than copy it into state inside an effect — that copy renders once with the
 * wrong value, which is a visible flash for anything shown on first paint. The
 * server snapshot is always empty, which is what makes hydration agree.
 *
 * What may be written is decided per store by its scope. `"local"` survives the
 * browser being closed and is reserved for opaque identifiers — the ids of
 * notifications already read. `"session"` dies with the tab and is what
 * anything a person typed uses, because a search term in this application is
 * routinely a client name or an account number and a branch workstation is
 * shared.
 *
 * `createRecordStore` is session-scoped for the same reason: a register's
 * filter selection is worth keeping while the operator walks away and comes
 * back, but not past the end of the session, and it must not follow them into a
 * second tab pointed at a different branch.
 */

const EMPTY: string[] = [];

export type StoreScope = "local" | "session";

export type StringListStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => string[];
  getServerSnapshot: () => string[];
  set: (next: string[]) => void;
};

export function createStringListStore(
  key: string,
  scope: StoreScope = "local",
): StringListStore {
  // Resolved per call rather than once: `window` does not exist when this
  // module is first evaluated on the server.
  const storage = () =>
    scope === "session" ? window.sessionStorage : window.localStorage;

  // Snapshots must be referentially stable between reads or React re-renders
  // forever, so the parsed value is cached until something invalidates it.
  let cache: string[] | null = null;
  const listeners = new Set<() => void>();

  function read(): string[] {
    try {
      const raw = storage().getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(parsed)) return EMPTY;
      const list = parsed.filter(
        (value): value is string => typeof value === "string",
      );
      return list.length > 0 ? list : EMPTY;
    } catch {
      // Blocked storage or corrupt JSON: behave as if nothing was stored.
      return EMPTY;
    }
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      // A second tab writing the same key must not leave this one stale.
      // `sessionStorage` is per-tab, so there is nothing to follow there.
      if (scope === "session") return () => listeners.delete(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        cache = null;
        emit();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot() {
      if (cache === null) cache = read();
      return cache;
    },
    getServerSnapshot() {
      return EMPTY;
    },
    set(next) {
      cache = next.length > 0 ? next : EMPTY;
      try {
        storage().setItem(key, JSON.stringify(cache));
      } catch {
        // Private mode or a full quota: the in-memory value still applies.
      }
      emit();
    },
  };
}

const EMPTY_RECORD: Record<string, string> = {};

/**
 * Same shape, nothing behind it — for a register that deliberately starts from
 * a clean filter set every visit.
 */
export function createMemoryRecordStore(): RecordStore {
  let value: Record<string, string> = EMPTY_RECORD;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => value,
    getServerSnapshot: () => EMPTY_RECORD,
    set(next) {
      const entries = Object.entries(next).filter(([, item]) => item !== "");
      value = entries.length > 0 ? Object.fromEntries(entries) : EMPTY_RECORD;
      for (const listener of listeners) listener();
    },
  };
}

export type RecordStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Record<string, string>;
  getServerSnapshot: () => Record<string, string>;
  set: (next: Record<string, string>) => void;
};

/**
 * Session-scoped string map, one key per register. Values are the filter
 * selections themselves — branch ids, statuses, dates — never a free-text
 * search term, which can be a client name and so stays in memory only.
 */
export function createRecordStore(key: string): RecordStore {
  let cache: Record<string, string> | null = null;
  const listeners = new Set<() => void>();

  function read(): Record<string, string> {
    try {
      const raw = window.sessionStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return EMPTY_RECORD;
      }
      const entries = Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      );
      return entries.length > 0 ? Object.fromEntries(entries) : EMPTY_RECORD;
    } catch {
      return EMPTY_RECORD;
    }
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      // `sessionStorage` is per-tab, so there is no cross-tab event to follow.
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      if (cache === null) cache = read();
      return cache;
    },
    getServerSnapshot() {
      return EMPTY_RECORD;
    },
    set(next) {
      const entries = Object.entries(next).filter(([, value]) => value !== "");
      cache = entries.length > 0 ? Object.fromEntries(entries) : EMPTY_RECORD;
      try {
        window.sessionStorage.setItem(key, JSON.stringify(cache));
      } catch {
        // Private mode or a full quota: the in-memory value still applies.
      }
      emit();
    },
  };
}

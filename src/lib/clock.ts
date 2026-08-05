"use client";

import { useSyncExternalStore } from "react";

/**
 * One shared minute-tick clock for every live countdown on screen.
 *
 * Exposed through `useSyncExternalStore` so the server (and the hydrating
 * render) sees `null` — countdowns only start once the component is live in
 * the browser, which keeps SSR output and first paint identical.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let snapshot = Date.now();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  timer ??= setInterval(() => {
    snapshot = Date.now();
    for (const listener of listeners) listener();
  }, 60_000);

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => null;

/** Current time, refreshed every minute. `null` until mounted. */
export function useMinuteClock(): Date | null {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return value === null ? null : new Date(value);
}

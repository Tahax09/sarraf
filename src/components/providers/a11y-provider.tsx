"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  a11yCookieString,
  defaultA11yPreferences,
  type A11yPreferences,
} from "@/lib/a11y-preferences";

type A11yContextValue = {
  preferences: A11yPreferences;
  /** Patch one or more settings; the rest are left alone. */
  update: (patch: Partial<A11yPreferences>) => void;
  reset: () => void;
};

const A11yContext = createContext<A11yContextValue | null>(null);

export function A11yProvider({
  initial,
  children,
}: {
  initial: A11yPreferences;
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState<A11yPreferences>(
    initial ?? defaultA11yPreferences,
  );

  const apply = useCallback((next: A11yPreferences) => {
    setPreferences(next);
    // Written straight to the element so the change is visible before the next
    // render, and to the cookie so the next SSR paint already matches.
    const root = document.documentElement;
    root.dataset.motion = next.motion;
    root.dataset.contrast = next.contrast;
    root.dataset.text = next.textSize;
    document.cookie = a11yCookieString(next);
  }, []);

  const value = useMemo<A11yContextValue>(
    () => ({
      preferences,
      update: (patch) => apply({ ...preferences, ...patch }),
      reset: () => apply(defaultA11yPreferences),
    }),
    [preferences, apply],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11yPreferences(): A11yContextValue {
  const context = useContext(A11yContext);
  if (!context) {
    throw new Error("useA11yPreferences must be used inside an <A11yProvider>");
  }
  return context;
}

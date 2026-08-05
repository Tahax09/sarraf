export const THEME_COOKIE = "SARAF_THEME";

export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];

export const defaultTheme: Theme = "light";

export function isTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Preference is kept in a plain (non-httpOnly) cookie so the server can render
 * the correct `data-theme` on the very first paint — no flash, no inline script.
 * It holds a UI preference only; never anything sensitive.
 */
export function themeCookieString(theme: Theme): string {
  const oneYear = 60 * 60 * 24 * 365;
  return `${THEME_COOKIE}=${theme}; path=/; max-age=${oneYear}; samesite=lax`;
}

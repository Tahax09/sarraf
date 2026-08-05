import { defineRouting } from "next-intl/routing";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

/** Layout direction is derived from the locale — never hardcoded in a shell. */
export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Arabic keeps the existing unprefixed URLs (/dashboard); English gets /en/*.
  localePrefix: "as-needed",
  localeCookie: {
    name: "SARAF_LOCALE",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    /**
     * Unlike the theme and accessibility cookies — written from the browser,
     * where `location.protocol` is the honest answer — this one is configured
     * once at module scope with no request in hand, so the build mode is the
     * only signal available. A production deployment is expected to terminate
     * TLS in front of the app; serving it over plain HTTP would drop the
     * cookie and fall back to the default locale.
     */
    secure: process.env.NODE_ENV === "production",
  },
});

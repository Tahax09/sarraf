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
  },
});

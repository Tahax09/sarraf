"use client";

import { useTranslations } from "next-intl";
import { formatYear } from "@/lib/format";

/**
 * The year the notice claims is the year the page is rendered, not a number
 * typed into a message: a hardcoded one is wrong every January, and it is the
 * kind of wrong nobody notices until a client does.
 *
 * `formatYear` so the digits follow the locale, like every other figure in the
 * panel — an Arabic page does not show a Latin year beside Arabic numerals —
 * but ungrouped, or 2026 renders as "2,026".
 */
export function AppFooter() {
  const t = useTranslations("app");
  const year = formatYear(new Date().getFullYear());

  return (
    <footer
      // Print carries its own header; a copyright line on every printed page
      // costs a line of a register the operator wanted the rows of.
      data-print-hide
      className="border-t border-border px-3 py-4 sm:px-5"
    >
      <p className="text-center text-[11px] text-fg-subtle">
        {t("copyright", { year })}
      </p>
    </footer>
  );
}

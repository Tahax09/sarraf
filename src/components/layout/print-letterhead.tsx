"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { isLocale, localeDirection } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";

import horizontalLtrBlack from "@/logo/LogoLTR-B.svg";
import horizontalRtlBlack from "@/logo/LogoRTL-B.svg";

/**
 * Letterhead for the printed page — the "Export PDF" path.
 *
 * Rendered once by the shell rather than by each report, so every page that can
 * be printed carries the same masthead and no page can forget it. On screen it
 * is `hidden`; the page's own `PageHeader` supplies the report title underneath,
 * which is why this block deliberately carries no title of its own.
 *
 * The black lockup is imported directly instead of going through `<Logo>`: that
 * component picks its artwork from the active theme, and the white cut a
 * dark-mode operator would get is invisible on paper.
 */
export function PrintLetterhead() {
  const locale = useLocale();
  const t = useTranslations("app");
  const direction = isLocale(locale) ? localeDirection[locale] : "rtl";

  /*
   * Stamped when the print dialog opens, not when the component renders.
   *
   * A timestamp computed during render is a hydration mismatch by construction
   * — the server's clock and the browser's are never the same millisecond — and
   * one computed on mount would say when the page was opened rather than when
   * the document was taken. `beforeprint` fires before the browser paginates,
   * so the state update is in the printed output.
   */
  const [stampedAt, setStampedAt] = useState<string | null>(null);

  useEffect(() => {
    const stamp = () => setStampedAt(formatDateTime(new Date().toISOString()));
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  return (
    <div className="hidden print:mb-4 print:flex print:items-end print:justify-between print:gap-4 print:border-b print:border-black/20 print:pb-3">
      <Image
        src={direction === "rtl" ? horizontalRtlBlack : horizontalLtrBlack}
        // Already resolution-independent; the optimizer would only re-encode it.
        unoptimized
        alt={t("name")}
        className="h-8 w-auto"
      />
      {stampedAt ? (
        <p className="identifier text-[10px] text-black/60">
          {t("generatedAt", { datetime: stampedAt })}
        </p>
      ) : null}
    </div>
  );
}

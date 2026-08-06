"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { SegmentedControl } from "@/components/ui/segmented-control";

/**
 * Each language names itself. A reader who has landed on the wrong one cannot
 * be asked to recognise "Arabic" written in a language they do not read.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

/**
 * Switches language in place: same route, same query, other locale. Kept as a
 * hook because the user menu renders the choice inside its own popover while
 * the sign-in page renders it as a standalone control, and the navigation is
 * the only part they share.
 */
export function useLocaleSwitch() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchLocale = (next: Locale) => {
    const query = searchParams.toString();
    startTransition(() => {
      // Switching language re-renders the whole page in the other direction.
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { locale: next });
    });
  };

  return { locale, pending, switchLocale };
}

/**
 * The language choice as a segmented control.
 *
 * Both options are on screen rather than behind a menu. On the sign-in page
 * that matters more than anywhere else in the panel: an operator who cannot
 * read the current language also cannot find a control labelled in it, and
 * this is the one page with no user menu to open.
 */
export function LocaleSwitcher({
  className,
  showIcon = false,
}: {
  className?: string;
  showIcon?: boolean;
}) {
  const t = useTranslations("user");
  const { locale, pending, switchLocale } = useLocaleSwitch();

  return (
    <SegmentedControl
      segments={locales.map((code) => ({
        value: code,
        label: LOCALE_NAMES[code],
      }))}
      value={locale}
      onChange={switchLocale}
      ariaLabel={t("language")}
      disabled={pending}
      className={className}
      leading={
        showIcon ? (
          <Languages
            className="mx-1 size-3.5 shrink-0 text-fg-muted"
            aria-hidden
          />
        ) : null
      }
    />
  );
}

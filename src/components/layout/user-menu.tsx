"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LogOut, Moon, Sun, User as UserIcon, Languages } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTheme } from "@/components/providers/theme-provider";
import { locales, type Locale } from "@/i18n/routing";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

const LOCALE_NAMES: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export function UserMenu({
  name,
  username,
}: {
  name: string;
  username: string;
}) {
  const t = useTranslations("user");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  function switchLocale(next: Locale) {
    const query = searchParams.toString();
    startTransition(() => {
      // Switching language re-renders the whole shell in the other direction.
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { locale: next });
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("menu")}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-fg hover:bg-surface-muted"
      >
        {initials || <UserIcon className="size-4" aria-hidden />}
      </button>

      {open ? (
        // `end-0`: the menu hangs from the trigger's reading-end edge — the
        // right in English, the left in Arabic.
        <div
          role="menu"
          className="absolute end-0 z-40 mt-2 w-60 overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-pop)]"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-fg">{name}</p>
            <p className="truncate text-xs text-fg-muted">{username}</p>
          </div>

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-surface-muted"
          >
            <UserIcon className="size-4" aria-hidden />
            {t("profile")}
          </Link>

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={theme === "dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-surface-muted"
          >
            {theme === "dark" ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Moon className="size-4" aria-hidden />
            )}
            {theme === "dark" ? t("themeLight") : t("themeDark")}
          </button>

          <div className="border-t border-border px-3 py-2">
            <p className="mb-1.5 flex items-center gap-2 text-xs text-fg-muted">
              <Languages className="size-3.5" aria-hidden />
              {t("language")}
            </p>
            <div className="flex gap-1">
              {locales.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === code}
                  disabled={pending}
                  onClick={() => switchLocale(code)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1 text-xs",
                    locale === code
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-fg-muted hover:text-fg",
                  )}
                >
                  {LOCALE_NAMES[code]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await apiFetch<void>(endpoints.logout, { method: "POST" }).catch(
                () => undefined,
              );
              router.push("/login");
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm text-danger hover:bg-danger-soft"
          >
            <LogOut className="rtl-flip size-4" aria-hidden />
            {t("logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

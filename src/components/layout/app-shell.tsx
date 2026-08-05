"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Menu, Search, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Logo } from "@/components/shared/logo";
import { SidebarNav } from "./sidebar";
import { UserMenu } from "./user-menu";
import { useCurrentUser, useDashboardSummary } from "@/lib/api/hooks";
import { mobileQuickNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const { data: summary } = useDashboardSummary();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [lastPath, setLastPath] = useState(pathname);

  // Route change closes the mobile drawer.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  const badges = {
    pendingAuthorized: summary?.pendingAuthorizedWithdrawals ?? 0,
    pendingExternal: summary?.pendingExternalTransfers ?? 0,
  };

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(
      `/core/analytics/all-operations?q=${encodeURIComponent(query.trim())}`,
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header
        data-print-hide
        className="sticky top-0 z-30 border-b border-border bg-surface"
      >
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={tNav("openMenu")}
            className="rounded-lg p-2 text-fg-muted hover:bg-surface-muted hover:text-fg lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <Link
            href="/dashboard"
            className="flex shrink-0 items-center"
            aria-label={tApp("name")}
          >
            <Logo className="h-7" decorative />
          </Link>

          {/* Quick Search lives in the header, not the sidebar. */}
          <form onSubmit={submitSearch} className="relative mx-auto w-full max-w-md">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
              style={{ insetInlineStart: "0.75rem" }}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t("search")}
              placeholder={t("globalSearchPlaceholder")}
              className="w-full rounded-lg border border-border bg-surface-muted py-2 ps-9 pe-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:bg-surface focus:outline-none"
            />
          </form>

          <div className="shrink-0">
            <UserMenu
              name={user?.name ?? "—"}
              username={user?.username ?? ""}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          data-print-hide
          className="hidden w-64 shrink-0 border-e border-border bg-surface lg:block"
        >
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
            <SidebarNav permissions={user?.permissions} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-3 pt-4 pb-24 sm:px-5 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={tNav("closeMenu")}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-[var(--color-overlay)]"
          />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex h-14 items-center justify-between border-b border-border px-3">
              <Logo className="h-6" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={tNav("closeMenu")}
                className="rounded-lg p-2 text-fg-muted hover:bg-surface-muted"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav
                permissions={user?.permissions}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Phone bottom nav — approvals are a realistic on-the-go task. */}
      <nav
        data-print-hide
        aria-label={tNav("mainNavigation")}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface lg:hidden"
      >
        {mobileQuickNav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon!;
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px]",
                active ? "text-accent" : "text-fg-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="truncate px-1">{tNav(item.labelKey)}</span>
              {count > 0 ? (
                <span className="numeric absolute top-1 end-[22%] rounded-full bg-warning px-1 text-[10px] font-medium text-white">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

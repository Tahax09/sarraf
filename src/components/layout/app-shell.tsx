"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "@/components/shared/logo";
import { Dialog } from "@/components/ui/dialog";
import { SidebarNav } from "./sidebar";
import { UserMenu } from "./user-menu";
import { AppShortcuts } from "./app-shortcuts";
import { AppFooter } from "./app-footer";
import { PrintLetterhead } from "./print-letterhead";
import { AccessibilityTrigger } from "./accessibility-center";
import { GlobalSearch, GlobalSearchTrigger } from "./global-search";
import {
  NotificationBell,
  NotificationCenter,
} from "./notification-center";
import { useCurrentUser, useDashboardSummary } from "@/lib/api/hooks";
import { NotificationProvider } from "@/lib/notifications/provider";
import { SearchProvider } from "@/components/providers/search-provider";
import { ShortcutProvider } from "@/lib/shortcuts";
import { mobileQuickNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Target of the skip link, and the landmark screen readers jump to. */
const MAIN_ID = "main-content";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    // Order matters: the palette and the notification centre both register
    // shortcuts, so the registry has to exist above them.
    <ShortcutProvider>
      <SearchProvider>
        <NotificationProvider>
          <Shell>{children}</Shell>
        </NotificationProvider>
      </SearchProvider>
    </ShortcutProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations("a11y");
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { data: summary } = useDashboardSummary();
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/*
       * First tab stop on every page. Without it, reaching the table on a
       * settings page means tabbing through the whole sidebar every time.
       */}
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg"
      >
        {t("skipToContent")}
      </a>

      <header
        data-print-hide
        className="sticky top-0 z-30 border-b border-border bg-surface"
      >
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={tNav("openMenu")}
            aria-expanded={drawerOpen}
            className="rounded-lg p-2 text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <Link
            href="/dashboard"
            className="flex shrink-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={tApp("name")}
          >
            <Logo className="h-7" decorative />
          </Link>

          {/*
           * The search affordance opens the command palette rather than
           * submitting a term to a URL — client names and account numbers must
           * not travel in query strings, history or referrers.
           */}
          {/*
           * `min-w-0`: the trigger truncates its own label, but a flex item
           * defaults to a min-width of its content — without this the header
           * refuses to fall below ~525px and every page scrolls sideways on a
           * phone.
           */}
          <div className="mx-auto w-full min-w-0 max-w-md">
            <GlobalSearchTrigger />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <AccessibilityTrigger className="hidden sm:inline-flex" />
            <NotificationBell />
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
          aria-label={tNav("mainNavigation")}
          className="hidden w-64 shrink-0 border-e border-border bg-surface lg:block"
        >
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
            <SidebarNav permissions={user?.permissions} />
          </div>
        </aside>

        {/* The footer belongs to the content column, not the whole shell: under
            the sidebar too it would sit against a navigation that scrolls
            separately. The phone's bottom nav is fixed, so the column keeps the
            clearance the main region used to carry. */}
        <div className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-0">
          <main
            id={MAIN_ID}
            tabIndex={-1}
            className="min-w-0 flex-1 px-3 pt-4 pb-8 focus:outline-none sm:px-5"
          >
            {/* Masthead for the printed page only. Here rather than in each
                report so no printable page can be published without it. */}
            <PrintLetterhead />
            {children}
          </main>

          <AppFooter />
        </div>
      </div>

      {/*
       * Mobile drawer. A native <dialog> so focus is trapped, the page behind
       * is inert and Escape closes it — the hand-rolled overlay this replaced
       * did none of the three.
       */}
      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        variant="drawer"
        title={<Logo className="h-6" />}
        className="lg:hidden"
      >
        <div className="-mx-4 -my-4">
          <SidebarNav
            permissions={user?.permissions}
            onNavigate={() => setDrawerOpen(false)}
          />
        </div>
      </Dialog>

      <GlobalSearch />
      <NotificationCenter />
      <AppShortcuts />

      {/* Phone bottom nav — approvals are a realistic on-the-go task. */}
      <nav
        data-print-hide
        aria-label={tNav("quickNavigation")}
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
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                active ? "text-accent" : "text-fg-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="truncate px-1">{tNav(item.labelKey)}</span>
              {count > 0 ? (
                <span className="numeric absolute top-1 end-[22%] rounded-full bg-warning px-1 text-[10px] font-medium text-white">
                  {/* Capped: a three-digit badge overflows the icon it sits on. */}
                  {count > 99 ? "99+" : count}
                  <span className="sr-only"> {tNav("pendingItems")}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

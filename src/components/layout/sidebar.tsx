"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { navGroups } from "@/lib/nav";
import { can, type PermissionMap } from "@/lib/permissions";
import { useDashboardSummary } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

function useBadgeCounts() {
  const { data } = useDashboardSummary();
  return {
    pendingAuthorized: data?.pendingAuthorizedWithdrawals ?? 0,
    pendingExternal: data?.pendingExternalTransfers ?? 0,
  };
}

export function SidebarNav({
  permissions,
  onNavigate,
}: {
  permissions: PermissionMap | undefined;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const badges = useBadgeCounts();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  /*
   * Each navigation starts the groups over: the one holding the open page is
   * expanded, the rest are as they were by default.
   *
   * Without this, a group the operator collapsed earlier stayed collapsed after
   * they navigated into it — reached through search or a link from another
   * page, the current page had no entry on screen and the sidebar gave no clue
   * where in the tree they were. A manual toggle is about the page being read
   * now, so it lasts exactly that long.
   */
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setCollapsed({});
  }

  return (
    <nav aria-label={t("mainNavigation")} className="space-y-1 p-3">
      {navGroups.map((group) => {
        const items = group.items.filter(
          (item) => !item.module || can(permissions, item.module, "view"),
        );
        if (items.length === 0) return null;

        const groupActive = items.some((item) => pathname.startsWith(item.href));
        const isCollapsed = collapsed[group.labelKey] ?? !groupActive;
        const GroupIcon = group.icon;

        return (
          <div key={group.labelKey}>
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [group.labelKey]: !isCollapsed,
                }))
              }
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                groupActive ? "text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              <GroupIcon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate text-start">
                {t(group.labelKey)}
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  isCollapsed && "-rotate-90 rtl:rotate-90",
                )}
              />
            </button>

            {!isCollapsed ? (
              <ul className="mt-0.5 space-y-0.5 ps-4">
                {items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const count = item.badge ? badges[item.badge] : 0;
                  const ItemIcon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "bg-accent-soft font-medium text-accent"
                            : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                        )}
                      >
                        {ItemIcon ? (
                          <ItemIcon className="size-4 shrink-0" aria-hidden />
                        ) : null}
                        <span className="flex-1 truncate">{t(item.labelKey)}</span>
                        {count > 0 ? (
                          <span className="numeric rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">
                            {count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

"use client";

import { useCallback, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Tabs, TabPanel, type TabItem } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

export type StatusTab<T extends string> = TabItem<T>;

/**
 * Tabbed status list shared by Authorized Withdrawal, External Transfer and
 * (Phase 2) the CBL purchase-request and contract lists. The active tab lives
 * in `?status=` so a queue view is linkable and survives a refresh.
 */
export function StatusTabbedList<T extends string>({
  tabs,
  defaultTab,
  ariaLabel,
  header,
  children,
}: {
  tabs: StatusTab<T>[];
  defaultTab: T;
  ariaLabel: string;
  header?: ReactNode;
  children: (status: T) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const param = searchParams.get("status") as T | null;
  const active = tabs.some((t) => t.value === param) ? (param as T) : defaultTab;

  const setActive = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-4">
      {header}
      <Card>
        <Tabs
          items={tabs}
          value={active}
          onChange={setActive}
          ariaLabel={ariaLabel}
          className="px-2"
        />
        <TabPanel value={active}>{children(active)}</TabPanel>
      </Card>
    </div>
  );
}

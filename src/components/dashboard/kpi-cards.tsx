"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeftRight,
  ChevronRight,
  Clock,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/states";
import { usePermission } from "@/lib/use-permission";
import type { PermissionModule } from "@/lib/permissions";
import { useDashboardSummary, useTrends } from "@/lib/api/hooks";
import { formatCount, formatPercentDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/lib/api/types";

/**
 * Change in total operations between the last two days of the trend series.
 *
 * Returns `null` rather than a zero when there is nothing to compare — one day
 * of history, or a previous day with no operations at all, where a percentage
 * would be a division by zero dressed up as a fact. No indicator is better than
 * a made-up one on a page an operator makes decisions from.
 */
export function dayOverDayDelta(points: TrendPoint[] | undefined): number | null {
  if (!points || points.length < 2) return null;
  const total = (point: TrendPoint) =>
    point.deposits + point.withdrawals + point.exchange;
  const previous = total(points[points.length - 2]);
  const current = total(points[points.length - 1]);
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** Local calendar date as `YYYY-MM-DD` — the shape the date filters take. */
function todayIso(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type Kpi = {
  key: string;
  label: string;
  value: string;
  icon: ReactNode;
  /**
   * Colour of the icon tile, as a theme variable. One hue per figure, so a card
   * is recognised by its colour before its label is read — and every value is
   * theme-aware, which a hardcoded hue would not be.
   *
   * Decoration only: it repeats what the icon and the label already say, and no
   * figure means anything different because of it.
   */
  color: string;
  /** Where the figure comes from — the card is a shortcut into that register. */
  href: string;
  /** Module the destination belongs to; an operator without it gets no link. */
  module: PermissionModule;
  tone?: "default" | "warning";
  delta?: { ratio: number; label: string } | null;
};

function DeltaLine({ ratio, label }: { ratio: number; label: string }) {
  const flat = ratio === 0;
  const Icon = flat ? Minus : ratio > 0 ? TrendingUp : TrendingDown;
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-xs font-medium",
        flat ? "text-fg-muted" : ratio > 0 ? "text-success" : "text-danger",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="numeric">{formatPercentDelta(ratio)}</span>
      {/* The comparison period is never implied — an arrow alone says nothing. */}
      <span className="truncate font-normal text-fg-muted">{label}</span>
    </p>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const permission = usePermission();
  const navigable = permission.can(kpi.module);

  const body = (
    <>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        // The tint is the icon's own colour at low opacity, mixed rather than
        // written down: one value per card stays right in both themes, and a
        // flat wash keeps the no-gradients rule.
        style={{
          color: kpi.color,
          backgroundColor: `color-mix(in srgb, ${kpi.color} 14%, transparent)`,
        }}
      >
        {kpi.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-fg-muted">{kpi.label}</span>
        <span
          className={cn(
            "numeric mt-1 block text-2xl font-semibold",
            kpi.tone === "warning" ? "text-warning" : "text-fg",
          )}
        >
          {kpi.value}
        </span>
        {kpi.delta ? (
          <DeltaLine ratio={kpi.delta.ratio} label={kpi.delta.label} />
        ) : null}
      </span>
      {navigable ? (
        <ChevronRight
          aria-hidden
          // Points the way the page reads: right in English, mirrored to left in
          // Arabic by `.rtl-flip`.
          className="rtl-flip size-4 shrink-0 self-center text-fg-subtle transition-colors group-hover:text-accent"
        />
      ) : null}
    </>
  );

  const shell =
    "flex items-start gap-3 rounded-card border border-border bg-surface p-4";

  // Without the permission to open the register, the figure still shows — it is
  // a summary of the operator's own branch — but it stops pretending to be a
  // door they can walk through.
  if (!navigable) return <div className={shell}>{body}</div>;

  return (
    <Link
      href={kpi.href}
      className={cn(
        shell,
        "group transition-colors hover:border-accent hover:bg-surface-muted",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {body}
    </Link>
  );
}

/**
 * The four figures the page opens with — the shape of the day at a glance.
 *
 * Each one is a separate card and each one is a shortcut: a number an operator
 * reacts to should take them to the records behind it, not leave them to find
 * the register in the sidebar and filter it by hand.
 */
export function DashboardKpiCards() {
  const t = useTranslations("dashboard");
  const summary = useDashboardSummary();
  // The 7-day series is the shortest window that answers "is today busier than
  // yesterday"; the query is shared with the trends cards whenever 7 is selected.
  const shortTrend = useTrends(7);

  if (summary.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[104px] w-full" />
        ))}
      </div>
    );
  }

  const pendingTotal =
    (summary.data?.pendingAuthorizedWithdrawals ?? 0) +
    (summary.data?.pendingExternalTransfers ?? 0);
  const operationsDelta = dayOverDayDelta(shortTrend.data);
  const today = todayIso();

  const kpis: Kpi[] = [
    {
      key: "clients",
      label: t("totalClients"),
      value: formatCount(summary.data?.totalClients ?? 0),
      icon: <Users className="size-4" />,
      color: "var(--color-accent)",
      href: "/core/clients/list",
      module: "clients",
    },
    {
      key: "accounts",
      label: t("totalAccounts"),
      value: formatCount(summary.data?.totalAccounts ?? 0),
      icon: <Wallet className="size-4" />,
      color: "var(--color-chart-deposit)",
      href: "/core/accounts",
      module: "accounts",
    },
    {
      key: "today",
      label: t("todayOperations"),
      value: formatCount(summary.data?.todayOperations ?? 0),
      icon: <ArrowLeftRight className="size-4" />,
      color: "var(--color-chart-4)",
      // The register opens already narrowed to today, so the count on screen is
      // the count that was clicked.
      href: `/core/analytics/all-operations?dateFrom=${today}&dateTo=${today}`,
      module: "analytics",
      delta:
        operationsDelta === null
          ? null
          : { ratio: operationsDelta, label: t("vsPreviousDay") },
    },
    {
      key: "pending",
      label: t("pendingApprovals"),
      value: formatCount(pendingTotal),
      icon: <Clock className="size-4" />,
      color: "var(--color-warning)",
      href: "/core/authorized-withdrawal?status=reserve",
      module: "authorizedWithdrawal",
      tone: pendingTotal > 0 ? "warning" : "default",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} />
      ))}
    </div>
  );
}

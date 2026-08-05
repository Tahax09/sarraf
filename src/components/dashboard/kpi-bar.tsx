"use client";

import { useTranslations } from "next-intl";
import { ArrowLeftRight, Clock, Users, Wallet } from "lucide-react";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { Skeleton } from "@/components/ui/states";
import { useDashboardSummary, useTrends } from "@/lib/api/hooks";
import { formatCount } from "@/lib/format";
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

/** The four figures the page opens with — the shape of the day at a glance. */
export function DashboardKpiBar() {
  const t = useTranslations("dashboard");
  const summary = useDashboardSummary();
  // The 7-day series is the shortest window that answers "is today busier than
  // yesterday"; the query is shared with the trends card whenever 7 is selected.
  const shortTrend = useTrends(7);

  if (summary.isLoading) return <Skeleton className="h-24 w-full" />;

  const pendingTotal =
    (summary.data?.pendingAuthorizedWithdrawals ?? 0) +
    (summary.data?.pendingExternalTransfers ?? 0);
  const operationsDelta = dayOverDayDelta(shortTrend.data);

  return (
    <HeaderStatBar
      stats={[
        {
          label: t("totalClients"),
          value: formatCount(summary.data?.totalClients ?? 0),
          numeric: true,
          icon: <Users className="size-4" />,
          iconTone: "accent",
        },
        {
          label: t("totalAccounts"),
          value: formatCount(summary.data?.totalAccounts ?? 0),
          numeric: true,
          icon: <Wallet className="size-4" />,
          iconTone: "accent",
        },
        {
          label: t("todayOperations"),
          value: formatCount(summary.data?.todayOperations ?? 0),
          numeric: true,
          icon: <ArrowLeftRight className="size-4" />,
          iconTone: "success",
          delta:
            operationsDelta === null
              ? undefined
              : { ratio: operationsDelta, label: t("vsPreviousDay") },
        },
        {
          label: t("pendingApprovals"),
          value: formatCount(pendingTotal),
          numeric: true,
          icon: <Clock className="size-4" />,
          tone: pendingTotal > 0 ? "warning" : "default",
          iconTone: pendingTotal > 0 ? "warning" : "default",
        },
      ]}
    />
  );
}

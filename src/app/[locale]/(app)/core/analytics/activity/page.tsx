"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { CategoryBarChart } from "@/components/charts";
import { useActivity } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatCount, formatDate, formatDateTime } from "@/lib/format";
import type { ActivityEvent } from "@/lib/api/types";

const DAYS = 7;

function dayKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

/** §6.7 — activity feed plus a 7-day breakdown. */
export default function ActivityPage() {
  const t = useTranslations("analytics");
  const tf = useTranslations("fields");
  const tStats = useTranslations("stats");
  const labels = useLabels();

  const query = useActivity();
  const events = useMemo(() => query.data ?? [], [query.data]);

  /**
   * §7 item 1: "Total activities" counts the activity events themselves. The
   * old panel summed a per-day series that both double-counted multi-type days
   * and dropped days with no events, so the figure never matched the feed.
   */
  const totalActivities = events.length;

  const breakdown = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - offset);
      buckets.set(dayKey(day), 0);
    }
    for (const event of events) {
      const key = dayKey(event.createdAt);
      // Only the last 7 days appear in the chart; older events still count
      // toward the total above.
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([date, count]) => ({
      date,
      label: formatDate(date),
      count,
    }));
  }, [events]);

  const inWindow = breakdown.reduce((sum, row) => sum + row.count, 0);

  const columns: Column<ActivityEvent>[] = [
    {
      key: "event",
      header: tf("type"),
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{labels.ledgerEvent(row.event)}</span>
          <span className="truncate text-xs text-fg-muted">
            {row.description}
          </span>
        </span>
      ),
    },
    {
      key: "actor",
      header: tf("username"),
      cell: (row) => row.actor,
    },
    {
      key: "createdAt",
      header: tf("timestamp"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-xs text-fg-muted">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("activityTitle")} />

      <HeaderStatBar
        stats={[
          {
            label: t("totalActivities"),
            value: formatCount(totalActivities),
            numeric: true,
          },
          {
            label: t("sevenDayBreakdown"),
            value: formatCount(inWindow),
            numeric: true,
          },
          {
            label: tStats("today"),
            value: formatCount(
              breakdown[breakdown.length - 1]?.count ?? 0,
            ),
            numeric: true,
          },
        ]}
      />

      <Card>
        <CardHeader title={t("sevenDayBreakdown")} />
        <CardBody>
          {query.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <CategoryBarChart
              data={breakdown as unknown as Record<string, unknown>[]}
              xKey="label"
              series={[
                {
                  key: "count",
                  label: t("totalActivities"),
                  color: "var(--color-chart-exchange)",
                },
              ]}
            />
          )}
        </CardBody>
        <DataTable
          columns={[
            {
              key: "label",
              header: tf("date"),
              primary: true,
              cell: (row) => (
                <span className="numeric text-sm">{row.label}</span>
              ),
            },
            {
              key: "count",
              header: tStats("count"),
              align: "end",
              cell: (row) => (
                <span className="numeric text-sm">{formatCount(row.count)}</span>
              ),
            },
          ]}
          rows={breakdown}
          getRowId={(row) => row.date}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("sevenDayBreakdown")}
          // Fixed-length companion to the chart above — seven rows, always.
          paginate={false}
        />
      </Card>

      <Card>
        <CardHeader title={t("recentActivity")} />
        <DataTable
          columns={columns}
          rows={events}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("recentActivity")}
        />
      </Card>
    </div>
  );
}

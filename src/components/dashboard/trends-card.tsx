"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { DataTable } from "@/components/shared/data-table";
import { ChartLegendSwatch, TrendAreaChart } from "@/components/charts";
import { useTrends } from "@/lib/api/hooks";
import { formatCount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The ranges the Dashboard offers; 30 is the default view. */
const TREND_RANGES = [7, 30, 60, 90] as const;
type TrendRange = (typeof TREND_RANGES)[number];

/**
 * A radiogroup, not a tablist: these buttons filter one set of charts rather
 * than swapping between panels.
 */
function TrendRangeSelector({
  value,
  onChange,
}: {
  value: TrendRange;
  onChange: (value: TrendRange) => void;
}) {
  const t = useTranslations("dashboard");
  return (
    <div
      role="radiogroup"
      aria-label={t("rangeLabel")}
      className="flex gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5"
    >
      {TREND_RANGES.map((days) => {
        const selected = days === value;
        return (
          <button
            key={days}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(days)}
            className={cn(
              "numeric rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selected ? "bg-surface text-accent" : "text-fg-muted hover:text-fg",
            )}
          >
            {t("rangeDays", { days: formatCount(days) })}
          </button>
        );
      })}
    </div>
  );
}

/** The trends — one place only (§7 item 3), three series side by side. */
export function TrendsCard() {
  const t = useTranslations("dashboard");
  const [days, setDays] = useState<TrendRange>(30);
  const query = useTrends(days);
  const points = (query.data ?? []).map((point, index) => ({
    ...point,
    // The axis carries the day's place in the range; the full date is on hover,
    // because 90 ISO dates on an axis are unreadable at any width.
    day: index + 1,
    fullDate: formatDate(point.date),
  }));
  const dateForDay = new Map(points.map((p) => [p.day, p.fullDate]));

  const series = [
    {
      key: "deposits" as const,
      label: t("trendDeposits"),
      color: "var(--color-chart-deposit)",
    },
    {
      key: "withdrawals" as const,
      label: t("trendWithdrawals"),
      color: "var(--color-chart-withdrawal)",
    },
    {
      key: "exchange" as const,
      label: t("trendExchange"),
      color: "var(--color-chart-exchange)",
    },
  ];

  return (
    <Card>
      <CardHeader
        title={t("trendsRange", { days: formatCount(days) })}
        action={<TrendRangeSelector value={days} onChange={setDays} />}
      />
      <CardBody>
        {/*
          Three charts share one dataset, so the card — not each chart — owns
          the loading and error state: three skeletons announcing themselves,
          or three retry buttons for one failed request, is noise.
        */}
        {query.isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {series.map((s) => (
              <div key={s.key} className="space-y-2">
                <ChartLegendSwatch color={s.color} label={s.label} />
                <TrendAreaChart
                  data={points}
                  xKey="day"
                  dataKey={s.key}
                  color={s.color}
                  height={180}
                  tooltipLabel={(value) =>
                    dateForDay.get(Number(value)) ?? String(value)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardBody>
      {/* Accessible fallback: the same points as an exact-figures table. */}
      <TrendTable days={days} />
    </Card>
  );
}

function TrendTable({ days }: { days: TrendRange }) {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const query = useTrends(days);

  return (
    <DataTable
      columns={[
        {
          key: "date",
          header: tf("date"),
          primary: true,
          cell: (row) => (
            <span className="numeric text-sm">{formatDate(row.date)}</span>
          ),
        },
        {
          key: "deposits",
          header: t("trendDeposits"),
          align: "end",
          cell: (row) => (
            <span className="numeric text-sm">{formatCount(row.deposits)}</span>
          ),
        },
        {
          key: "withdrawals",
          header: t("trendWithdrawals"),
          align: "end",
          cell: (row) => (
            <span className="numeric text-sm">
              {formatCount(row.withdrawals)}
            </span>
          ),
        },
        {
          key: "exchange",
          header: t("trendExchange"),
          align: "end",
          cell: (row) => (
            <span className="numeric text-sm">{formatCount(row.exchange)}</span>
          ),
        },
      ]}
      rows={query.data ?? []}
      getRowId={(row) => row.date}
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => query.refetch()}
      caption={t("trendsRange", { days: formatCount(days) })}
    />
  );
}

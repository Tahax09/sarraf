"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChartSpline } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { DataTable } from "@/components/shared/data-table";
import { TrendAreaChart } from "@/components/charts";
import { usePermission } from "@/lib/use-permission";
import { useTrends } from "@/lib/api/hooks";
import { formatCount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OperationType, TrendPoint } from "@/lib/api/types";

/** The ranges the Dashboard offers; 30 is the default view. */
const TREND_RANGES = [7, 30, 60, 90] as const;
type TrendRange = (typeof TREND_RANGES)[number];

/**
 * One card per series (§R3-4). Each carries the operation type it summarises so
 * its "view all" action lands on the register already narrowed to the same
 * records the chart drew — the figure clicked is the figure shown.
 */
const SERIES = [
  {
    key: "deposits",
    labelKey: "trendDeposits",
    descriptionKey: "trendDepositsDescription",
    color: "var(--color-chart-deposit)",
    type: "deposit",
  },
  {
    key: "withdrawals",
    labelKey: "trendWithdrawals",
    descriptionKey: "trendWithdrawalsDescription",
    color: "var(--color-chart-withdrawal)",
    type: "withdrawal",
  },
  {
    key: "exchange",
    labelKey: "trendExchange",
    descriptionKey: "trendExchangeDescription",
    color: "var(--color-chart-exchange)",
    type: "currencyExchangeTransfer",
  },
] as const satisfies readonly {
  key: keyof Omit<TrendPoint, "date">;
  labelKey: string;
  descriptionKey: string;
  color: string;
  type: OperationType;
}[];

type Series = (typeof SERIES)[number];

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

/** The window the chart actually drew, taken from the points rather than from
 *  the clock, so the link cannot narrow the register to a range the chart never
 *  covered. */
function rangeOf(points: TrendPoint[]): { from: string; to: string } | null {
  if (points.length === 0) return null;
  return { from: points[0].date, to: points[points.length - 1].date };
}

/**
 * One series, with its own title, description, action and states.
 *
 * Every card reads the same query — deduped by the query cache — but renders
 * its own outcome, so a card is never left blank next to two that drew.
 */
function TrendChartCard({
  series,
  days,
}: {
  series: Series;
  days: TrendRange;
}) {
  const t = useTranslations("dashboard");
  const permission = usePermission();
  const query = useTrends(days);

  const points = (query.data ?? []).map((point, index) => ({
    ...point,
    // The axis carries the day's place in the range; the full date is on hover,
    // because 90 ISO dates on an axis are unreadable at any width.
    day: index + 1,
    fullDate: formatDate(point.date),
  }));
  const dateForDay = new Map(points.map((p) => [p.day, p.fullDate]));
  const range = rangeOf(query.data ?? []);

  // A series can be flat at zero while the others move — that is an empty card,
  // not an empty dashboard, and a flat line at the axis says nothing.
  const empty =
    points.length === 0 || points.every((point) => point[series.key] === 0);

  const href = range
    ? `/core/analytics/all-operations?type=${series.type}&dateFrom=${range.from}&dateTo=${range.to}`
    : "/core/analytics/all-operations";

  return (
    <Card>
      <CardHeader
        title={t(series.labelKey)}
        description={t(series.descriptionKey)}
        action={
          permission.can("analytics") ? (
            <Link
              href={href}
              className="rounded-md px-1 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("viewAll")}
            </Link>
          ) : null
        }
      />
      <CardBody>
        {query.isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : empty ? (
          <EmptyState
            icon={<ChartSpline className="size-5" />}
            title={t("trendEmpty")}
          />
        ) : (
          <TrendAreaChart
            data={points}
            xKey="day"
            dataKey={series.key}
            color={series.color}
            height={180}
            tooltipLabel={(value) =>
              dateForDay.get(Number(value)) ?? String(value)
            }
          />
        )}
      </CardBody>
    </Card>
  );
}

/**
 * The trends — one place only (§7 item 3), one card per series rather than a
 * single block carrying three charts, so each has room for its own title,
 * description and states.
 *
 * The range is chosen once for the section: three selectors would let an
 * operator compare a 7-day deposit chart with a 90-day withdrawal chart without
 * noticing.
 */
export function TrendsCard() {
  const t = useTranslations("dashboard");
  const [days, setDays] = useState<TrendRange>(30);

  return (
    <section aria-label={t("trendsRange", { days: formatCount(days) })} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg sm:text-base">
          {t("trendsRange", { days: formatCount(days) })}
        </h2>
        <TrendRangeSelector value={days} onChange={setDays} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {SERIES.map((series) => (
          <TrendChartCard key={series.key} series={series} days={days} />
        ))}
      </div>

      {/* Accessible fallback: the same points as an exact-figures table. */}
      <Card>
        <CardHeader title={t("trendFigures")} />
        <TrendTable days={days} />
      </Card>
    </section>
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

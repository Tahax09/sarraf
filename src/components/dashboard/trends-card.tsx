"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChartColumn, ChartLine, ChartSpline } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { DataTable } from "@/components/shared/data-table";
import { CategoryBarChart, TrendLineChart } from "@/components/charts";
import { usePermission } from "@/lib/use-permission";
import { useTrends } from "@/lib/api/hooks";
import { formatCount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OperationType, TrendPoint } from "@/lib/api/types";

/** The ranges the Dashboard offers; 30 is the default view. */
const TREND_RANGES = [7, 30, 60, 90] as const;
type TrendRange = (typeof TREND_RANGES)[number];

/**
 * How the same points are drawn. A line reads the shape of a period; bars read
 * one day against the next. Which one an operator wants is a matter of the
 * question they arrived with, so it is theirs to choose rather than ours to
 * decide — the figures underneath do not change either way.
 */
const CHART_TYPES = ["line", "bar"] as const;
type ChartType = (typeof CHART_TYPES)[number];

const CHART_TYPE_ICONS = { line: ChartLine, bar: ChartColumn } as const;

/**
 * The three series the Dashboard tracks. Each carries the operation type it
 * summarises, so that when the chart is narrowed to one of them the register
 * link can be narrowed to the same records — the figure clicked is the figure
 * shown.
 */
const SERIES = [
  {
    key: "deposits",
    labelKey: "trendDeposits",
    color: "var(--color-chart-deposit)",
    type: "deposit",
  },
  {
    key: "withdrawals",
    labelKey: "trendWithdrawals",
    color: "var(--color-chart-withdrawal)",
    type: "withdrawal",
  },
  {
    key: "exchange",
    labelKey: "trendExchange",
    color: "var(--color-chart-exchange)",
    type: "currencyExchangeTransfer",
  },
] as const satisfies readonly {
  key: keyof Omit<TrendPoint, "date">;
  labelKey: string;
  color: string;
  type: OperationType;
}[];

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
              selected
                ? "bg-surface text-accent"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {t("rangeDays", { days: formatCount(days) })}
          </button>
        );
      })}
    </div>
  );
}

/** Same control, for the drawing style. Icon-only: the shapes say it faster
 *  than the words, and the accessible name carries the word. */
function ChartTypeSelector({
  value,
  onChange,
}: {
  value: ChartType;
  onChange: (value: ChartType) => void;
}) {
  const t = useTranslations("dashboard");
  return (
    <div
      role="radiogroup"
      aria-label={t("chartTypeLabel")}
      className="flex gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5"
    >
      {CHART_TYPES.map((type) => {
        const selected = type === value;
        const Icon = CHART_TYPE_ICONS[type];
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(type === "line" ? "chartTypeLine" : "chartTypeBar")}
            onClick={() => onChange(type)}
            className={cn(
              "rounded-md px-2.5 py-1 transition-colors",
              selected
                ? "bg-surface text-accent"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" aria-hidden />
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
 * The one query behind the section, shaped for drawing. Both the chart and the
 * figures table read it; the query cache serves them from a single fetch.
 */
function useTrendPoints(days: TrendRange) {
  const query = useTrends(days);
  const points = (query.data ?? []).map((point, index) => ({
    ...point,
    // The axis carries the day's place in the range; the full date is on hover,
    // because 90 ISO dates on an axis are unreadable at any width.
    day: index + 1,
    fullDate: formatDate(point.date),
  }));
  const dateForDay = new Map(points.map((p) => [p.day, p.fullDate]));
  return {
    query,
    points,
    range: rangeOf(query.data ?? []),
    tooltipLabel: (value: unknown) =>
      dateForDay.get(Number(value)) ?? String(value),
  };
}

/**
 * The trends — one place only (§7 item 3). All three series share one pair of
 * axes rather than one card each: the question a dashboard is opened with is
 * how the three moved *against each other*, which no amount of looking between
 * separate cards answers well.
 *
 * Three controls, all of them the operator's: the range, the drawing style, and
 * which series are on show. None of them changes a figure — the table below
 * carries the same numbers whatever is selected.
 */
export function TrendsCard() {
  const t = useTranslations("dashboard");
  const [days, setDays] = useState<TrendRange>(30);
  const [chartType, setChartType] = useState<ChartType>("line");

  return (
    <section
      aria-label={t("trendsRange", { days: formatCount(days) })}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg sm:text-base">
          {t("trendsRange", { days: formatCount(days) })}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <ChartTypeSelector value={chartType} onChange={setChartType} />
          <TrendRangeSelector value={days} onChange={setDays} />
        </div>
      </div>

      <TrendComparisonCard days={days} chartType={chartType} />

      {/* Accessible fallback: the same points as an exact-figures table. */}
      <Card>
        <CardHeader title={t("trendFigures")} />
        <TrendTable days={days} />
      </Card>
    </section>
  );
}

/**
 * The chart itself, with the set of series on show under the operator's
 * control: all three is the comparison, but two of them is often the question —
 * deposits against withdrawals, with exchange out of the way.
 *
 * The filter is presentational. It picks what is drawn from points already
 * fetched, so toggling a series costs nothing and never refetches.
 */
function TrendComparisonCard({
  days,
  chartType,
}: {
  days: TrendRange;
  chartType: ChartType;
}) {
  const t = useTranslations("dashboard");
  const permission = usePermission();
  const { query, points, range, tooltipLabel } = useTrendPoints(days);
  const [hidden, setHidden] = useState<readonly string[]>([]);

  const shown = SERIES.filter((series) => !hidden.includes(series.key));
  const chartSeries = shown.map((series) => ({
    key: series.key,
    label: t(series.labelKey),
    color: series.color,
  }));

  const toggle = (key: string) =>
    setHidden((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    );

  // The register, narrowed to what is on screen: the drawn window always, and
  // the operation type too when the filter has left exactly one series — the
  // records the chart is showing are then the records the link opens.
  const params = new URLSearchParams();
  if (shown.length === 1) params.set("type", shown[0].type);
  if (range) {
    params.set("dateFrom", range.from);
    params.set("dateTo", range.to);
  }
  const href = `/core/analytics/all-operations${params.size ? `?${params}` : ""}`;

  return (
    <Card>
      <CardHeader
        title={t("trendComparison")}
        description={t("trendComparisonDescription")}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label={t("trendSeriesLabel")}
              className="flex flex-wrap gap-1.5"
            >
              {SERIES.map((series) => {
                const on = !hidden.includes(series.key);
                return (
                  <button
                    key={series.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(series.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      on
                        ? "border-border bg-surface-muted text-fg"
                        : "border-dashed border-border text-fg-subtle hover:text-fg-muted",
                    )}
                  >
                    {/* The swatch is the only tie between a chip and its line, so
                      it keeps its colour when the series is off — dimmed, not
                      recoloured, or the chip stops naming which line it hides. */}
                    <span
                      aria-hidden
                      className={cn(
                        "size-2.5 shrink-0 rounded-[2px] transition-opacity",
                        on ? "opacity-100" : "opacity-30",
                      )}
                      style={{ backgroundColor: series.color }}
                    />
                    {t(series.labelKey)}
                  </button>
                );
              })}
            </div>

            {permission.can("analytics") ? (
              <Link
                href={href}
                className="rounded-md px-1 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t("viewAll")}
              </Link>
            ) : null}
          </div>
        }
      />
      <CardBody>
        {query.isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<ChartSpline className="size-5" />}
            title={t("trendNoSeries")}
          />
        ) : points.length === 0 ? (
          <EmptyState
            icon={<ChartSpline className="size-5" />}
            title={t("trendEmpty")}
          />
        ) : chartType === "bar" ? (
          <CategoryBarChart
            data={points}
            xKey="day"
            series={chartSeries}
            height={260}
            minTickGap={24}
            tooltipLabel={tooltipLabel}
          />
        ) : (
          <TrendLineChart
            data={points}
            xKey="day"
            series={chartSeries}
            height={260}
            tooltipLabel={tooltipLabel}
          />
        )}
      </CardBody>
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

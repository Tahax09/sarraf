"use client";

import { useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { localeDirection, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { formatCount, formatNumber } from "@/lib/format";
import { SERIES_COLORS } from "./palette";

/**
 * Chart type follows the shape of the data (§3.1): trends over time are
 * line/area, cumulative movement is an area, category comparison is a bar
 * chart, parts of a whole is a donut, and a grouped total is a stacked bar.
 * Fills are flat — no gradients — and every chart ships with the underlying
 * table as its accessible fallback.
 *
 * Direction: recharts draws into an SVG and takes physical `left`/`right`
 * values, which CSS `dir="rtl"` does not mirror. Every axis, margin and legend
 * placement below is therefore derived from the locale rather than written
 * down, so an Arabic reader gets the value axis on the reading-start side and
 * time running right-to-left.
 */

const axisProps = {
  stroke: "var(--color-fg-subtle)",
  tick: { fill: "var(--color-fg-muted)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/** True when the active locale reads right-to-left. */
function useRtl(): boolean {
  return localeDirection[useLocale() as Locale] === "rtl";
}

/** Physical margins from logical intent: `end` is the axis-free side. */
function chartMargin(rtl: boolean) {
  return rtl
    ? { top: 8, right: 0, bottom: 0, left: 8 }
    : { top: 8, right: 8, bottom: 0, left: 0 };
}

function tooltipProps(rtl: boolean) {
  return {
    contentStyle: {
      backgroundColor: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "0.5rem",
      fontSize: 12,
      color: "var(--color-fg)",
      direction: rtl ? ("rtl" as const) : ("ltr" as const),
      textAlign: rtl ? ("right" as const) : ("left" as const),
    },
    labelStyle: { color: "var(--color-fg-muted)" },
    itemStyle: { color: "var(--color-fg)" },
  };
}

function legendStyle(rtl: boolean) {
  return {
    fontSize: 11,
    color: "var(--color-fg-muted)",
    direction: rtl ? ("rtl" as const) : ("ltr" as const),
  };
}

/** Axis pair shared by every cartesian chart, mirrored for RTL. */
function CartesianAxes({
  xKey,
  rtl,
  tickFormatter = (value: unknown) => formatCount(Number(value)),
  minTickGap,
}: {
  xKey: string;
  rtl: boolean;
  tickFormatter?: (value: unknown) => string;
  minTickGap?: number;
}) {
  return (
    <>
      <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
      <XAxis dataKey={xKey} {...axisProps} reversed={rtl} minTickGap={minTickGap} />
      <YAxis
        {...axisProps}
        width={56}
        orientation={rtl ? "right" : "left"}
        tickFormatter={tickFormatter}
      />
    </>
  );
}

type ChartStateProps = {
  height?: number;
  /** Nothing to draw yet — shows a skeleton the size of the finished chart. */
  loading?: boolean;
  /** The fetch failed; the card keeps its footprint and offers a retry. */
  error?: boolean;
  onRetry?: () => void;
  /**
   * One sentence describing what the chart shows, announced to screen readers
   * in place of the SVG. Omit it when an exact-figures table sits alongside.
   */
  summary?: string;
};

function ChartFrame({
  children,
  height = 240,
  empty,
  loading,
  error,
  onRetry,
  summary,
}: ChartStateProps & { children: ReactNode; empty?: boolean }) {
  const t = useTranslations("charts");
  const tc = useTranslations("common");

  if (loading) {
    return (
      // No live announcement: the drawing is decorative, and the card that
      // carries it — a table, a KPI row — already announces its own load.
      <div style={{ height }} aria-busy>
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-3 text-center"
      >
        <p className="text-xs text-fg-muted">{tc("errorBody")}</p>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {tc("retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (empty) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <p className="text-center text-xs text-fg-muted">{t("noData")}</p>
      </div>
    );
  }

  return (
    <>
      {/* The drawing itself is decorative: either the paired table carries the
          same figures, or `summary` states them in a sentence. Exposing a few
          hundred unlabelled SVG nodes would be worse than either. */}
      {summary ? <p className="sr-only">{summary}</p> : null}
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          {children as never}
        </ResponsiveContainer>
      </div>
    </>
  );
}

/** A value accumulating over time — one metric per chart. */
export function TrendAreaChart({
  data,
  dataKey,
  xKey = "date",
  color,
  tooltipLabel,
  ...state
}: ChartStateProps & {
  data: Record<string, unknown>[];
  dataKey: string;
  xKey?: string;
  color: string;
  /** Turns the terse axis value into the full label shown on hover. */
  tooltipLabel?: (value: unknown) => string;
}) {
  const rtl = useRtl();
  return (
    <ChartFrame {...state} empty={data.length === 0}>
      <AreaChart data={data} margin={chartMargin(rtl)}>
        <CartesianAxes xKey={xKey} rtl={rtl} minTickGap={24} />
        <Tooltip {...tooltipProps(rtl)} labelFormatter={tooltipLabel} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          // Flat translucent fill, deliberately not a gradient.
          fill={color}
          fillOpacity={0.12}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartFrame>
  );
}

/**
 * Several metrics moving over the same period. Lines rather than stacked areas:
 * the question here is which series is higher, not what they sum to.
 */
export function TrendLineChart({
  data,
  xKey = "date",
  series,
  tooltipLabel,
  ...state
}: ChartStateProps & {
  data: Record<string, unknown>[];
  xKey?: string;
  series: { key: string; label: string; color: string }[];
  tooltipLabel?: (value: unknown) => string;
}) {
  const rtl = useRtl();
  return (
    <ChartFrame {...state} empty={data.length === 0}>
      <LineChart data={data} margin={chartMargin(rtl)}>
        <CartesianAxes xKey={xKey} rtl={rtl} minTickGap={24} />
        <Tooltip {...tooltipProps(rtl)} labelFormatter={tooltipLabel} />
        <Legend wrapperStyle={legendStyle(rtl)} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

/** Composition of a whole — always paired with the exact-figures table. */
export function CompositionDonut({
  data,
  nameKey,
  valueKey,
  height = 240,
  legend = "bottom",
  ...state
}: ChartStateProps & {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  /**
   * `side` keeps the ring compact: a horizontal legend under a donut forces the
   * card wide and squashes the ring once the labels wrap.
   */
  legend?: "bottom" | "side";
}) {
  const rtl = useRtl();
  const total = useMemo(
    () => data.reduce((sum, row) => sum + Number(row[valueKey] ?? 0), 0),
    [data, valueKey],
  );

  // A side legend sits on the reading-end side, so the ring shifts to start.
  const sideAlign = rtl ? ("left" as const) : ("right" as const);
  const sideCx = rtl ? "62%" : "38%";

  return (
    <ChartFrame
      {...state}
      height={height}
      empty={data.length === 0 || total === 0}
    >
      <PieChart>
        <Pie
          data={data}
          nameKey={nameKey}
          dataKey={valueKey}
          innerRadius="58%"
          outerRadius="85%"
          paddingAngle={1}
          stroke="var(--color-surface)"
          cx={legend === "side" ? sideCx : "50%"}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipProps(rtl)}
          formatter={(value) => formatNumber(Number(value), 0)}
        />
        <Legend
          {...(legend === "side"
            ? ({
                layout: "vertical",
                align: sideAlign,
                verticalAlign: "middle",
              } as const)
            : {})}
          wrapperStyle={legendStyle(rtl)}
        />
      </PieChart>
    </ChartFrame>
  );
}

/** Comparing discrete categories — grouped bars for paired comparisons. */
export function CategoryBarChart({
  data,
  xKey,
  series,
  stacked = false,
  ...state
}: ChartStateProps & {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  /**
   * Stack when the series are parts of one total worth reading as a whole;
   * leave them grouped when the comparison is series against series.
   */
  stacked?: boolean;
}) {
  const rtl = useRtl();
  const last = series.length - 1;
  return (
    <ChartFrame {...state} empty={data.length === 0}>
      <BarChart data={data} margin={chartMargin(rtl)}>
        <CartesianAxes xKey={xKey} rtl={rtl} />
        <Tooltip
          {...tooltipProps(rtl)}
          cursor={{ fill: "var(--color-surface-muted)" }}
        />
        <Legend wrapperStyle={legendStyle(rtl)} />
        {series.map((s, index) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={stacked ? "total" : undefined}
            // Only the top of a stack gets the rounded cap.
            radius={stacked && index !== last ? undefined : [4, 4, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

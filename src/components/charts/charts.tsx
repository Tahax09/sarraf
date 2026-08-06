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
import { formatCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
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

type LegendEntry = { value?: unknown; color?: string };

/**
 * The legend recharts draws paints every label in its own series colour,
 * centres the column and leaves no gap after the swatch — which reads as an
 * overlap once the label is Arabic. This one is plain markup: aligned swatches,
 * muted labels, and the reading direction of the page.
 */
function ChartLegend({
  payload,
  rtl,
  layout,
}: {
  /** Supplied by recharts, which clones this element with the series it drew. */
  payload?: LegendEntry[];
  rtl: boolean;
  layout: "vertical" | "horizontal";
}) {
  return (
    <ul
      dir={rtl ? "rtl" : "ltr"}
      className={cn(
        "flex gap-x-4 gap-y-1 text-[11px] text-fg-muted",
        layout === "vertical" ? "flex-col" : "flex-wrap justify-center",
      )}
    >
      {(payload ?? []).map((entry, index) => (
        <li key={index} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: entry.color }}
          />
          <span>{String(entry.value ?? "")}</span>
        </li>
      ))}
    </ul>
  );
}

function legendProps(
  rtl: boolean,
  layout: "vertical" | "horizontal" = "horizontal",
) {
  return { content: <ChartLegend rtl={rtl} layout={layout} /> };
}

/** Axis pair shared by every cartesian chart, mirrored for RTL. */
function CartesianAxes({
  xKey,
  rtl,
  tickFormatter = (value: unknown) => formatCompact(Number(value)),
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
      <XAxis
        dataKey={xKey}
        {...axisProps}
        reversed={rtl}
        minTickGap={minTickGap}
      />
      <YAxis
        {...axisProps}
        width={56}
        orientation={rtl ? "right" : "left"}
        tickFormatter={tickFormatter}
      />
    </>
  );
}

/**
 * The chart's numbers, as text. Rendered for screen readers only, because the
 * drawing itself is `aria-hidden`: several hundred unlabelled SVG nodes are not
 * a text alternative, and recharts' tooltips are mouse-only, so the figures a
 * sighted reader gets on hover have no keyboard path at all.
 *
 * Built by each chart from the props it already has, so the alternative cannot
 * drift from what was drawn — and cannot be forgotten. A card that already
 * shows the same numbers in a visible table passes `figures="adjacent"` instead,
 * which is the only way to opt out and says why in the diff.
 */
type FiguresTable = {
  caption: string;
  /* Whole units, matching the visible tables these charts sit beside and the
     donut's own tooltip: an operation count read as "40.000" is worse than no
     table at all. */
  /** Heads the first column, the one naming each row. */
  rowHeader: string;
  columns: string[];
  rows: { label: string; values: string[] }[];
};

type ChartStateProps = {
  height?: number;
  /** Nothing to draw yet — shows a skeleton the size of the finished chart. */
  loading?: boolean;
  /** The fetch failed; the card keeps its footprint and offers a retry. */
  error?: boolean;
  onRetry?: () => void;
  /**
   * Set when a visible table on the same card already lists these figures, so
   * the reader is not read the same numbers twice.
   */
  figures?: "adjacent";
};

/** One `<td>` per series value, one `<th scope="row">` naming the row. */
function ScreenReaderFigures({ table }: { table: FiguresTable }) {
  return (
    <table className="sr-only">
      <caption>{table.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{table.rowHeader}</th>
          {table.columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {row.values.map((value, index) => (
              <td key={index} className="numeric">
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartFrame({
  children,
  height = 240,
  empty,
  loading,
  error,
  onRetry,
  figures,
  figuresTable,
}: ChartStateProps & {
  children: ReactNode;
  empty?: boolean;
  figuresTable: FiguresTable;
}) {
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
      {figures === "adjacent" ? null : (
        <ScreenReaderFigures table={figuresTable} />
      )}
      {/* `dir="ltr"` on the drawing surface, deliberately, inside an RTL page.
          recharts positions every tick with an absolute `x` plus an SVG
          `text-anchor`, and `text-anchor: start` resolves to the *right* edge of
          the glyph run under `direction: rtl` — so a right-hand value axis drew
          its labels leftwards, on top of the series. The axis text is digits and
          dates, which read LTR anyway; the legend and the tooltip carry their own
          `direction` so their Arabic labels are unaffected. Mirroring stays where
          it belongs: `orientation`, `reversed` and the margins below. */}
      {/* `inert` as well as `aria-hidden`. recharts gives its own wrapper a
          `tabindex`, so hiding the surface from the accessibility tree left a
          tab stop that focused something a reader could not then describe —
          the worst of both, and a real WCAG 4.1.2 failure rather than a
          cosmetic one. `inert` removes the whole subtree from sequential focus
          along with anything the library adds to it later; `aria-hidden` stays
          because it is what states the intent. The figures table above is the
          text alternative, and it is reachable. */}
      <div style={{ height }} dir="ltr" aria-hidden inert>
        <ResponsiveContainer width="100%" height="100%">
          {children as never}
        </ResponsiveContainer>
      </div>
    </>
  );
}

/**
 * The row labels for a cartesian chart: the same text the tooltip would show,
 * so "day 3" reads as the date a hovering reader would have been given.
 */
function rowLabels<Row extends object>(
  data: Row[],
  xKey: Key<Row>,
  tooltipLabel?: (value: unknown) => string,
): string[] {
  return data.map((row) => {
    const value = row[xKey];
    return tooltipLabel ? tooltipLabel(value) : String(value ?? "");
  });
}

/**
 * A field of the row type, by name. Every chart takes its keys this way, so a
 * renamed field fails to compile at the call site instead of silently drawing
 * an empty series — which is what the `as unknown as Record<string, unknown>[]`
 * casts these props replaced used to allow.
 */
type Key<Row> = Extract<keyof Row, string>;

export type Series<Row> = { key: Key<Row>; label: string; color: string };

/** A value accumulating over time — one metric per chart. */
export type TrendAreaChartProps<Row> = ChartStateProps & {
  data: Row[];
  dataKey: Key<Row>;
  xKey?: Key<Row>;
  color: string;
  /** Names the series in the figures table; the card title names the chart. */
  label: string;
  /** Turns the terse axis value into the full label shown on hover. */
  tooltipLabel?: (value: unknown) => string;
};

export function TrendAreaChart<Row extends object>({
  data,
  dataKey,
  xKey = "date" as Key<Row>,
  color,
  label,
  tooltipLabel,
  ...state
}: TrendAreaChartProps<Row>) {
  const rtl = useRtl();
  const t = useTranslations("charts");
  const labels = rowLabels(data, xKey, tooltipLabel);

  return (
    <ChartFrame
      {...state}
      empty={data.length === 0}
      figuresTable={{
        caption: t("dataTableFallback"),
        rowHeader: t("period"),
        columns: [label],
        rows: data.map((row, index) => ({
          label: labels[index] ?? "",
          values: [formatNumber(Number(row[dataKey] ?? 0), 0)],
        })),
      }}
    >
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
export type TrendLineChartProps<Row> = ChartStateProps & {
  data: Row[];
  xKey?: Key<Row>;
  series: Series<Row>[];
  tooltipLabel?: (value: unknown) => string;
};

export function TrendLineChart<Row extends object>({
  data,
  xKey = "date" as Key<Row>,
  series,
  tooltipLabel,
  ...state
}: TrendLineChartProps<Row>) {
  const rtl = useRtl();
  const t = useTranslations("charts");
  const labels = rowLabels(data, xKey, tooltipLabel);

  return (
    <ChartFrame
      {...state}
      empty={data.length === 0}
      figuresTable={{
        caption: t("dataTableFallback"),
        rowHeader: t("period"),
        columns: series.map((s) => s.label),
        rows: data.map((row, index) => ({
          label: labels[index] ?? "",
          values: series.map((s) => formatNumber(Number(row[s.key] ?? 0), 0)),
        })),
      }}
    >
      <LineChart data={data} margin={chartMargin(rtl)}>
        <CartesianAxes xKey={xKey} rtl={rtl} minTickGap={24} />
        <Tooltip {...tooltipProps(rtl)} labelFormatter={tooltipLabel} />
        <Legend {...legendProps(rtl)} />
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
export type CompositionDonutProps<Row> = ChartStateProps & {
  data: Row[];
  nameKey: Key<Row>;
  valueKey: Key<Row>;
  /**
   * `side` keeps the ring compact: a horizontal legend under a donut forces the
   * card wide and squashes the ring once the labels wrap.
   */
  legend?: "bottom" | "side";
};

export function CompositionDonut<Row extends object>({
  data,
  nameKey,
  valueKey,
  height = 240,
  legend = "bottom",
  ...state
}: CompositionDonutProps<Row>) {
  const rtl = useRtl();
  const t = useTranslations("charts");
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
      figuresTable={{
        caption: t("dataTableFallback"),
        rowHeader: t("category"),
        columns: [t("value")],
        rows: data.map((row) => ({
          label: String(row[nameKey] ?? ""),
          values: [formatNumber(Number(row[valueKey] ?? 0), 0)],
        })),
      }}
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
            <Cell
              key={index}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            />
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
          {...legendProps(rtl, legend === "side" ? "vertical" : "horizontal")}
        />
      </PieChart>
    </ChartFrame>
  );
}

/** Comparing discrete categories — grouped bars for paired comparisons. */
export type CategoryBarChartProps<Row> = ChartStateProps & {
  data: Row[];
  xKey: Key<Row>;
  series: Series<Row>[];
  /**
   * Stack when the series are parts of one total worth reading as a whole;
   * leave them grouped when the comparison is series against series.
   */
  stacked?: boolean;
  /** Off for a single series, where the legend only repeats the card title. */
  legend?: boolean;
  /** Turns the terse axis value into the full label shown on hover. */
  tooltipLabel?: (value: unknown) => string;
  minTickGap?: number;
};

export function CategoryBarChart<Row extends object>({
  data,
  xKey,
  series,
  stacked = false,
  legend = true,
  tooltipLabel,
  minTickGap,
  ...state
}: CategoryBarChartProps<Row>) {
  const rtl = useRtl();
  const t = useTranslations("charts");
  const last = series.length - 1;
  const labels = rowLabels(data, xKey, tooltipLabel);

  return (
    <ChartFrame
      {...state}
      empty={data.length === 0}
      figuresTable={{
        caption: t("dataTableFallback"),
        rowHeader: t("category"),
        columns: series.map((s) => s.label),
        rows: data.map((row, index) => ({
          label: labels[index] ?? "",
          values: series.map((s) => formatNumber(Number(row[s.key] ?? 0), 0)),
        })),
      }}
    >
      <BarChart data={data} margin={chartMargin(rtl)}>
        <CartesianAxes xKey={xKey} rtl={rtl} minTickGap={minTickGap} />
        <Tooltip
          {...tooltipProps(rtl)}
          labelFormatter={tooltipLabel}
          cursor={{ fill: "var(--color-surface-muted)" }}
        />
        {legend ? <Legend {...legendProps(rtl)} /> : null}
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

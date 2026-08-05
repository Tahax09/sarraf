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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { formatCount, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Chart type follows the shape of the data (§3.1): trends over time are
 * line/area, composition is a donut, category comparison is a bar chart.
 * Fills are flat — no gradients — and every chart ships with the underlying
 * table as its accessible fallback.
 */

const SERIES_COLORS = [
  "var(--color-chart-exchange)",
  "var(--color-chart-deposit)",
  "var(--color-chart-withdrawal)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

const axisProps = {
  stroke: "var(--color-fg-subtle)",
  tick: { fill: "var(--color-fg-muted)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

const tooltipProps = {
  contentStyle: {
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.5rem",
    fontSize: 12,
    color: "var(--color-fg)",
  },
  labelStyle: { color: "var(--color-fg-muted)" },
  itemStyle: { color: "var(--color-fg)" },
} as const;

function ChartFrame({
  children,
  height = 240,
  empty,
}: {
  children: ReactNode;
  height?: number;
  empty?: boolean;
}) {
  const t = useTranslations("charts");
  if (empty) {
    return (
      <p className="py-10 text-center text-xs text-fg-muted">{t("noData")}</p>
    );
  }
  return (
    // Charts are decorative here; the paired table carries the same data.
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

/** A value changing over time — one metric per chart. */
export function TrendAreaChart({
  data,
  dataKey,
  xKey = "date",
  color,
  height,
  tooltipLabel,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  xKey?: string;
  color: string;
  height?: number;
  /** Turns the terse axis value into the full label shown on hover. */
  tooltipLabel?: (value: unknown) => string;
}) {
  return (
    <ChartFrame height={height} empty={data.length === 0}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} minTickGap={24} />
        <YAxis {...axisProps} width={56} tickFormatter={(v) => formatCount(Number(v))} />
        <Tooltip {...tooltipProps} labelFormatter={tooltipLabel} />
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

/** Composition of a whole — always paired with the exact-figures table. */
export function CompositionDonut({
  data,
  nameKey,
  valueKey,
  height = 240,
  legend = "bottom",
}: {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  height?: number;
  /**
   * `side` keeps the ring compact: a horizontal legend under a donut forces the
   * card wide and squashes the ring once the labels wrap.
   */
  legend?: "bottom" | "side";
}) {
  const total = useMemo(
    () => data.reduce((sum, row) => sum + Number(row[valueKey] ?? 0), 0),
    [data, valueKey],
  );

  return (
    <ChartFrame height={height} empty={data.length === 0 || total === 0}>
      <PieChart>
        <Pie
          data={data}
          nameKey={nameKey}
          dataKey={valueKey}
          innerRadius="58%"
          outerRadius="85%"
          paddingAngle={1}
          stroke="var(--color-surface)"
          cx={legend === "side" ? "38%" : "50%"}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipProps}
          formatter={(value) => formatNumber(Number(value), 0)}
        />
        <Legend
          {...(legend === "side"
            ? ({
                layout: "vertical",
                align: "right",
                verticalAlign: "middle",
              } as const)
            : {})}
          wrapperStyle={{ fontSize: 11, color: "var(--color-fg-muted)" }}
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
  height,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <ChartFrame height={height} empty={data.length === 0}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={56} tickFormatter={(v) => formatCount(Number(v))} />
        <Tooltip {...tooltipProps} cursor={{ fill: "var(--color-surface-muted)" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-fg-muted)" }} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function ChartLegendSwatch({
  color,
  label,
  className,
}: {
  color: string;
  label: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-fg-muted", className)}>
      <span
        aria-hidden
        className="size-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export { SERIES_COLORS };

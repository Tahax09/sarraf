"use client";

import { useId, type ReactNode } from "react";
import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePermission } from "@/lib/use-permission";
import type { PermissionModule } from "@/lib/permissions";
import { formatPercentDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Change against a comparison period. A bare arrow says nothing, so `label`
 * ("vs yesterday") is always rendered next to it — a reader must never have to
 * guess what a figure is being compared with.
 */
export type StatDelta = {
  /** Signed fraction: 0.12 is +12%, -0.05 is −5%. */
  ratio: number;
  label: ReactNode;
  /** False where a rise is bad news — a pending queue, a failure count. */
  goodWhenUp?: boolean;
};

export type HeaderStat = {
  label: ReactNode;
  value: ReactNode;
  /** Lucide icon element — rendered in a tinted square ahead of the figure. */
  icon?: ReactNode;
  /**
   * Colour of the icon tile, as a theme variable — the same treatment the
   * Dashboard's KPI cards use, so a figure is recognised by its colour before
   * its label is read. Decoration only: it repeats what the icon and the label
   * already say, and never carries meaning on its own.
   */
  color?: string;
  /** Values that are amounts/counts render LTR with tabular figures. */
  numeric?: boolean;
  tone?: "default" | "success" | "danger" | "warning" | "accent";
  delta?: StatDelta;
  /**
   * Register the figure was counted from, narrowed to what the figure counts —
   * the card becomes the way in. Set it only where the destination really shows
   * those records: a count of the very table underneath is not a shortcut.
   */
  href?: string;
  /** Module the destination belongs to; an operator without it gets no link. */
  module?: PermissionModule;
};

const TONES: Record<NonNullable<HeaderStat["tone"]>, string> = {
  default: "text-fg",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  accent: "text-accent",
};

/**
 * Palette for a run of same-kind figures — the per-currency page totals every
 * register carries. Cycled by position so two totals side by side never share a
 * colour; the colour distinguishes cards, it does not stand for a currency.
 */
export const STAT_COLORS = [
  "var(--color-chart-exchange)",
  "var(--color-chart-deposit)",
  "var(--color-chart-4)",
  "var(--color-chart-6)",
];

/** Icon tile colour when a stat names none — matches the figure's own tone. */
const TONE_COLORS: Record<NonNullable<HeaderStat["tone"]>, string> = {
  default: "var(--color-fg-muted)",
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  warning: "var(--color-warning)",
  accent: "var(--color-accent)",
};

/**
 * Colour follows the meaning of the movement, not its sign: more pending
 * approvals is not good news. Flat stays neutral — a 0% change is information,
 * not a warning.
 */
function DeltaIndicator({ delta }: { delta: StatDelta }) {
  const rising = delta.ratio > 0;
  const flat = delta.ratio === 0;
  const good = (delta.goodWhenUp ?? true) === rising;
  const Icon = flat ? Minus : rising ? TrendingUp : TrendingDown;

  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-xs font-medium",
        flat ? "text-fg-muted" : good ? "text-success" : "text-danger",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="numeric">{formatPercentDelta(delta.ratio)}</span>
      {/* The comparison period is never implied — an arrow alone says nothing. */}
      <span className="truncate font-normal text-fg-muted">{delta.label}</span>
    </p>
  );
}

/**
 * Standard count/total summary above every list and queue page — one component
 * so the treatment is identical across modules.
 *
 * Each figure is its own card, matching the Dashboard's KPI row: a register's
 * summary and the overview it was reached from should not look like two
 * different kinds of thing. Cards are separated rather than sharing one panel,
 * so a figure reads as a figure and not as a cell in a table.
 */
/**
 * Columns for the number of figures actually supplied, so a row of two does not
 * stretch each card across half the page.
 */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function HeaderStatBar({
  stats,
  className,
}: {
  stats: HeaderStat[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-3",
        COLUMNS[Math.min(stats.length, 4)] ?? COLUMNS[4],
        className,
      )}
    >
      {stats.map((stat, index) => (
        <StatCard key={index} stat={stat} />
      ))}
    </dl>
  );
}

function StatCard({ stat }: { stat: HeaderStat }) {
  const permission = usePermission();
  // Same rule as the Dashboard's KPI row: the figure still shows without the
  // permission to open the register, it just stops pretending to be a door.
  const navigable = Boolean(stat.href) && (!stat.module || permission.can(stat.module));

  // `<dl>` may hold `<div>` groups but never an `<a>`, so the card stays a
  // group and the link is stretched over it — one target covering the whole
  // card, named by the label the reader sees.
  const labelId = useId();

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-card border border-border bg-surface p-4",
        navigable && "relative transition-colors hover:border-accent",
      )}
    >
      {stat.icon ? (
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          // The tint is the icon's own colour at low opacity, mixed rather
          // than written down: one value per card stays right in both
          // themes, and a flat wash keeps the no-gradients rule.
          style={{
            color: stat.color ?? TONE_COLORS[stat.tone ?? "default"],
            backgroundColor: `color-mix(in srgb, ${
              stat.color ?? TONE_COLORS[stat.tone ?? "default"]
            } 14%, transparent)`,
          }}
        >
          {stat.icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <dt id={labelId} className="text-xs text-fg-muted">
          {stat.label}
        </dt>
        <dd
          className={cn(
            "mt-1 text-xl font-semibold",
            stat.numeric && "numeric",
            TONES[stat.tone ?? "default"],
          )}
        >
          {/* Isolated: a figure carrying a Latin currency code must not be
          re-ordered by the Arabic label above it. */}
          <bdi className="block truncate">{stat.value}</bdi>
          {stat.delta ? <DeltaIndicator delta={stat.delta} /> : null}
        </dd>
      </div>
      {navigable ? (
        <>
          <ChevronRight
            aria-hidden
            // Points the way the page reads: right in English, mirrored to left
            // in Arabic by `.rtl-flip`.
            className="rtl-flip size-4 shrink-0 self-center text-fg-subtle transition-colors group-hover:text-accent"
          />
          <Link
            href={stat.href!}
            aria-labelledby={labelId}
            className="absolute inset-0 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </>
      ) : null}
    </div>
  );
}

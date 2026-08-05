"use client";

import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
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
  /** Values that are amounts/counts render LTR with tabular figures. */
  numeric?: boolean;
  tone?: "default" | "success" | "danger" | "warning" | "accent";
  /** Tints the icon square alone; falls back to `tone`. Keeps figures neutral. */
  iconTone?: "default" | "success" | "danger" | "warning" | "accent";
  delta?: StatDelta;
};

const TONES: Record<NonNullable<HeaderStat["tone"]>, string> = {
  default: "text-fg",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  accent: "text-accent",
};

const ICON_TONES: Record<NonNullable<HeaderStat["tone"]>, string> = {
  default: "bg-surface-muted text-fg-muted",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  accent: "bg-accent-soft text-accent",
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
 */
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
        "grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {stats.map((stat, index) => (
        <div key={index} className="flex items-center gap-3 bg-surface px-4 py-3">
          {stat.icon ? (
            <span
              aria-hidden
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                ICON_TONES[stat.iconTone ?? stat.tone ?? "default"],
              )}
            >
              {stat.icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <dt className="text-xs text-fg-muted">{stat.label}</dt>
            <dd
              className={cn(
                "mt-1 text-lg font-semibold",
                stat.numeric && "numeric",
                TONES[stat.tone ?? "default"],
              )}
            >
              {/* Isolated: a figure carrying a Latin currency code must not be
              re-ordered by the Arabic label above it. */}
          <bdi>{stat.value}</bdi>
              {stat.delta ? <DeltaIndicator delta={stat.delta} /> : null}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

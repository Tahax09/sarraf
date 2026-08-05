"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
              {stat.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "danger"
  | "warning"
  | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-fg-muted border-border",
  info: "bg-info-soft text-info border-info/30",
  success: "bg-success-soft text-success border-success/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  accent: "bg-accent-soft text-accent border-accent/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

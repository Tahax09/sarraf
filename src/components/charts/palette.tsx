import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The parts of the chart module that do not touch recharts. They live apart so
 * that a page can label a series, or paint a swatch, without pulling the
 * charting library into its first load — see the facade in `index.tsx`.
 */

export const SERIES_COLORS = [
  "var(--color-chart-exchange)",
  "var(--color-chart-deposit)",
  "var(--color-chart-withdrawal)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

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
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-fg-muted",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

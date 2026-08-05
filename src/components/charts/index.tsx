"use client";

import { lazy, Suspense, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/states";
import type * as Impl from "./charts";

/**
 * The public face of the chart module. Call sites import from here and get the
 * same components with the same props; what changes is *when* the drawing code
 * arrives.
 *
 * recharts is ~400 kB of the client bundle — larger than the rest of a register
 * page put together — and every page that carries a chart also carries the
 * table holding the same figures. Loading it lazily lets the figures, the
 * filters and the navigation become usable while the drawing is still on its
 * way; the placeholder below reserves the chart's exact height, so nothing
 * moves when it lands.
 *
 * `ChartLegendSwatch` and `SERIES_COLORS` come from `./palette` instead: they
 * are a coloured square and a list of CSS variables, and routing them through
 * the lazy boundary would pull the library back in for no reason.
 */

export { ChartLegendSwatch, SERIES_COLORS } from "./palette";

/** Reserves the finished chart's footprint so the card does not jump. */
function ChartPlaceholder({ height = 240 }: { height?: number }) {
  return (
    <div style={{ height }} aria-busy>
      <Skeleton className="h-full w-full" />
    </div>
  );
}

// One import specifier for all four: the bundler emits a single chunk, so the
// first chart on a page pays for the library and the rest are free.
const load = () => import("./charts");

const TrendAreaChartImpl = lazy(() =>
  load().then((m) => ({ default: m.TrendAreaChart })),
);
const TrendLineChartImpl = lazy(() =>
  load().then((m) => ({ default: m.TrendLineChart })),
);
const CompositionDonutImpl = lazy(() =>
  load().then((m) => ({ default: m.CompositionDonut })),
);
const CategoryBarChartImpl = lazy(() =>
  load().then((m) => ({ default: m.CategoryBarChart })),
);

export function TrendAreaChart(
  props: ComponentProps<typeof Impl.TrendAreaChart>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={props.height} />}>
      <TrendAreaChartImpl {...props} />
    </Suspense>
  );
}

export function TrendLineChart(
  props: ComponentProps<typeof Impl.TrendLineChart>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={props.height} />}>
      <TrendLineChartImpl {...props} />
    </Suspense>
  );
}

export function CompositionDonut(
  props: ComponentProps<typeof Impl.CompositionDonut>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={props.height} />}>
      <CompositionDonutImpl {...props} />
    </Suspense>
  );
}

export function CategoryBarChart(
  props: ComponentProps<typeof Impl.CategoryBarChart>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={props.height} />}>
      <CategoryBarChartImpl {...props} />
    </Suspense>
  );
}

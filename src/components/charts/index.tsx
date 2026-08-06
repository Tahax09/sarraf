"use client";

import { lazy, Suspense, type ComponentType } from "react";
import { Skeleton } from "@/components/ui/states";
import type * as Impl from "./charts";
import type {
  CategoryBarChartProps,
  CompositionDonutProps,
  TrendAreaChartProps,
  TrendLineChartProps,
} from "./charts";

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
 * `SERIES_COLORS` comes from `./palette` instead: it is a list of CSS
 * variables, and routing it through the lazy boundary would pull the library
 * back in for no reason.
 *
 * Each wrapper restates its generic instead of deriving props from the lazy
 * handle. `React.lazy` is typed over a *concrete* component, so anything
 * derived through it collapses the row parameter to its constraint and every
 * `xKey` at every call site becomes `never` — which is what forced the
 * `as unknown as Record<string, unknown>[]` casts these charts used to need at
 * six call sites. Each handle is cast straight back to the generic signature it
 * was loaded from, so the erasure is undone once, here, rather than worked
 * around everywhere it surfaces.
 */

export { SERIES_COLORS } from "./palette";
export type { Series } from "./charts";

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
  load().then((m) => ({ default: m.TrendAreaChart as ComponentType<Record<string, unknown>> })),
) as unknown as typeof Impl.TrendAreaChart;

const TrendLineChartImpl = lazy(() =>
  load().then((m) => ({ default: m.TrendLineChart as ComponentType<Record<string, unknown>> })),
) as unknown as typeof Impl.TrendLineChart;

const CompositionDonutImpl = lazy(() =>
  load().then((m) => ({ default: m.CompositionDonut as ComponentType<Record<string, unknown>> })),
) as unknown as typeof Impl.CompositionDonut;

const CategoryBarChartImpl = lazy(() =>
  load().then((m) => ({ default: m.CategoryBarChart as ComponentType<Record<string, unknown>> })),
) as unknown as typeof Impl.CategoryBarChart;

export function TrendAreaChart<Row extends object>(
  props: TrendAreaChartProps<Row>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={props.height} />}>
      <TrendAreaChartImpl {...props} />
    </Suspense>
  );
}

export function TrendLineChart<Row extends object>(
  props: TrendLineChartProps<Row>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={props.height} />}>
      <TrendLineChartImpl {...props} />
    </Suspense>
  );
}

export function CompositionDonut<Row extends object>(
  props: CompositionDonutProps<Row>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={props.height} />}>
      <CompositionDonutImpl {...props} />
    </Suspense>
  );
}

export function CategoryBarChart<Row extends object>(
  props: CategoryBarChartProps<Row>,
) {
  return (
    <Suspense fallback={<ChartPlaceholder height={props.height} />}>
      <CategoryBarChartImpl {...props} />
    </Suspense>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { emit } from "@/lib/observability/telemetry";
import { startTrace } from "@/lib/observability/correlation";
import { isEnabled } from "@/lib/observability/flags";

/**
 * Client instrumentation. Renders nothing and returns nothing — it exists to
 * be mounted once, above the app, and to be deletable in one line.
 *
 * Two signals, both of which answer a question an operator's complaint raises
 * and a screenshot cannot:
 *
 * - **Web Vitals.** "The dashboard is slow" is a report about a device, a
 *   network and a branch, none of which reproduce at a developer's desk. LCP
 *   and INP measured on the machine that was actually slow do reproduce.
 * - **Navigations.** Each one starts a new trace, so the fan-out of requests a
 *   screen makes reads as one unit rather than as unrelated calls that happen
 *   to share a second.
 *
 * Both are gated on the `telemetry` flag *and* on a sink being registered, so
 * a deployment that has wired nothing pays for nothing. The route *name* is
 * emitted, never the URL: a client profile URL carries an id, and an id is the
 * kind of thing that must not end up in a third-party trace store.
 */

/**
 * `/ar/core/clients/cli_1000` → `/core/clients/[id]`.
 *
 * Locale prefix dropped (it is carried as an attribute), and any segment that
 * looks like an identifier collapsed to `[id]`. Without this, cardinality
 * explodes and every dashboard built on the data is unreadable — one row per
 * client is not a metric.
 */
export function routeName(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "ar" || segments[0] === "en") segments.shift();

  const normalized = segments.map((segment) =>
    /\d/.test(segment) || segment.length > 24 ? "[id]" : segment,
  );

  return `/${normalized.join("/")}`;
}

/** Web Vitals thresholds are per-metric; the collector decides, we only report. */
function reportVital(metric: {
  name: string;
  value: number;
  rating?: string;
  id: string;
}): void {
  emit({
    kind: "vital",
    name: `vital.${metric.name}`,
    level: metric.rating === "poor" ? "warning" : "info",
    // CLS is unitless; the rest are milliseconds. Rounded because no collector
    // needs fourteen decimal places of a layout shift.
    durationMs: Math.round(metric.value * 1000) / 1000,
    attributes: { rating: metric.rating ?? null, metricId: metric.id },
  });
}

export function TelemetryProvider() {
  const pathname = usePathname();
  const on = isEnabled("telemetry");

  // The callback reference must be stable or Next re-reports metrics already
  // seen; `reportVital` is module scope, so it is.
  useReportWebVitals(on ? reportVital : noop);

  useEffect(() => {
    if (!on) return;
    startTrace();
    emit({
      kind: "navigation",
      name: "route.opened",
      level: "info",
      attributes: { route: routeName(pathname) },
    });
  }, [on, pathname]);

  return null;
}

function noop() {}

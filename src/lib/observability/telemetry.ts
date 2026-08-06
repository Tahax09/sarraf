/**
 * The one seam through which anything the application knows about itself
 * leaves the browser.
 *
 * Nothing here talks to a vendor, and nothing here should ever have to. The
 * application emits typed events; a *sink* decides what becomes of them. That
 * inversion is the whole point: adding OpenTelemetry, Sentry, or a home-grown
 * collector is a registration at start-up, not an edit to a page, a hook, or a
 * fetch wrapper. Application logic never learns which one is installed, so it
 * cannot start depending on one.
 *
 * ## Wiring a vendor (illustrative — no vendor SDK is a dependency of this
 * repository)
 *
 * ```ts
 * // src/app/[locale]/layout.tsx, or any module imported once at start-up
 * registerTelemetrySink((event) => {
 *   if (event.kind === "error") Sentry.captureException(...);
 *   else span(event.name, event.attributes);
 * });
 * ```
 *
 * ## The default sink
 *
 * There isn't one, and that is deliberate. Posting telemetry to an endpoint
 * this repository invented would be a backend contract nobody agreed to. Until
 * a deployment registers a sink, events are dropped after the development-mode
 * console line — with one exception, documented in `report-error.ts`, where the
 * backend already owns an endpoint for UI errors.
 *
 * ## What must never be emitted
 *
 * Attributes are diagnostic breadcrumbs, not a data dump. No account numbers,
 * no IBANs, no client names, no amounts, no search terms, no tokens, no
 * anything an operator typed. Route *names* rather than URLs where a URL could
 * carry an id. `assertSafeAttributes` catches the obvious mistakes in
 * development; it is a seatbelt, not a substitute for thinking.
 */
import { buildInfo } from "@/lib/observability/build-info";
import { sessionId, traceId } from "@/lib/observability/correlation";

/** Severity, in the sense every collector already understands. */
export type TelemetryLevel = "debug" | "info" | "warning" | "error";

export type TelemetryAttributes = Record<
  string,
  string | number | boolean | null | undefined
>;

export type TelemetryEvent = {
  /**
   * What kind of thing happened. Kept small on purpose — a sink switches on
   * this, and a sink that has to switch on twenty values is a sink nobody will
   * write correctly.
   *
   * - `navigation` — a journey started (a route was opened).
   * - `vital` — a Core Web Vitals measurement.
   * - `request` — an API call finished, well or badly.
   * - `error` — something was caught by a boundary or a handler.
   * - `action` — an operator did something worth counting.
   */
  kind: "navigation" | "vital" | "request" | "error" | "action";
  /** Dotted, stable, low-cardinality: `route.opened`, `vital.LCP`. */
  name: string;
  level: TelemetryLevel;
  /** Milliseconds, when the event measures something. */
  durationMs?: number;
  attributes?: TelemetryAttributes;
};

/** What a sink receives: the event plus the context every event shares. */
export type TelemetryRecord = TelemetryEvent & {
  at: string;
  sessionId: string;
  traceId: string;
  release: string;
  environment: string;
};

export type TelemetrySink = (record: TelemetryRecord) => void;

const sinks: TelemetrySink[] = [];

/**
 * Installs a sink. Returns the function that removes it again, which matters
 * for tests and for a sink that is swapped at runtime behind a feature flag.
 *
 * Multiple sinks are allowed: a deployment may want traces in one system and
 * errors in another, and forcing that choice into a single adapter is how
 * observability wiring turns into its own subsystem.
 */
export function registerTelemetrySink(sink: TelemetrySink): () => void {
  sinks.push(sink);
  return () => {
    const index = sinks.indexOf(sink);
    if (index >= 0) sinks.splice(index, 1);
  };
}

/** Test seam. Production never needs it — sinks are registered once. */
export function clearTelemetrySinks(): void {
  sinks.length = 0;
}

/**
 * Keys whose *name* alone says the value should not be here. The check runs in
 * development only: it is a review aid, and a production build should not pay
 * for it on every event.
 */
const FORBIDDEN_KEY = /(iban|account(number|no)?|password|token|secret|amount|phone|email|query|term|name)/i;

function assertSafeAttributes(event: TelemetryEvent): void {
  if (process.env.NODE_ENV !== "development") return;
  for (const key of Object.keys(event.attributes ?? {})) {
    if (FORBIDDEN_KEY.test(key)) {
      console.warn(
        `[telemetry] attribute "${key}" on "${event.name}" looks like operator ` +
          `data. Telemetry carries diagnostics, not values — rename it or drop it.`,
      );
    }
  }
}

/**
 * Emits an event to every registered sink.
 *
 * Never throws. A sink that fails is a broken sink, and a broken sink must not
 * become a broken application — telemetry that can take down the screen it is
 * measuring is worse than no telemetry.
 */
export function emit(event: TelemetryEvent): void {
  assertSafeAttributes(event);

  if (sinks.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[telemetry] ${event.kind}:${event.name}`, event.attributes);
    }
    return;
  }

  const record: TelemetryRecord = {
    ...event,
    at: new Date().toISOString(),
    sessionId: sessionId(),
    traceId: traceId(),
    release: buildInfo.version,
    environment: buildInfo.environment,
  };

  for (const sink of sinks) {
    try {
      sink(record);
    } catch {
      /* A sink's failure is the sink's problem. */
    }
  }
}

/** True when anything is listening. Lets a caller skip expensive attribute work. */
export function hasTelemetrySink(): boolean {
  return sinks.length > 0;
}

# Observability

What the panel can tell you about itself, and what it deliberately refuses to
tell anyone.

The shape of all of it is one decision: **the application emits typed events; a
sink decides what becomes of them.** Nothing in `src/` imports a vendor SDK, and
nothing should. Wiring Sentry, an OpenTelemetry exporter or a home-grown
collector is a registration at start-up, not an edit to a page, a hook or a
fetch wrapper — so application logic never learns which one is installed and
cannot start depending on it.

## The pieces

| Module | What it owns |
| --- | --- |
| `src/lib/observability/telemetry.ts` | The event type, the sink registry, `emit()`, and the development-only check that keeps sensitive keys out of attributes. |
| `src/lib/observability/correlation.ts` | Request, session and trace ids, and the headers the API client sends. |
| `src/lib/observability/build-info.ts` | What this build *is*: version, commit, build time, environment. |
| `src/lib/observability/flags.ts` | The enumerated feature-flag set, read from the environment at build time. |
| `src/lib/report-error.ts` | The single seam through which a caught error leaves the browser. |
| `src/components/providers/telemetry-provider.tsx` | Mounts Web Vitals reporting and starts a trace per navigation. Renders nothing. |
| `src/components/shared/build-diagnostics.tsx` | The operator-facing panel: build, environment, API mode, session id, flag states — copyable as plain text. |

## Turning it on

Nothing is emitted by default, and that is not an oversight. A default sink
would mean this repository inventing a backend contract nobody agreed to. Until
a deployment registers a sink, events are dropped after a development-mode
console line.

```ts
// Any module imported once at start-up — e.g. src/app/[locale]/layout.tsx
registerTelemetrySink((record) => {
  if (record.kind === "error") Sentry.captureException(record);
  else span(record.name, record.attributes);
});
```

Two conditions gate the client instrumentation: the `telemetry` feature flag
*and* a registered sink. A deployment that wired neither pays for neither.

```
NEXT_PUBLIC_FEATURE_FLAGS=telemetry
```

The one exception is `reportError()`, which also POSTs to the backend's existing
UI-event endpoint whether or not a sink exists. That path already exists and
already receives sensitive-field reveal events; losing it would trade a working
destination for a possible one.

## The event

```ts
type TelemetryRecord = {
  kind: "navigation" | "vital" | "request" | "error" | "action";
  name: string;            // dotted, stable, low-cardinality: route.opened, vital.LCP
  level: "debug" | "info" | "warning" | "error";
  durationMs?: number;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  at: string;
  sessionId: string;
  traceId: string;
  release: string;
  environment: string;
};
```

`kind` is small on purpose. A sink switches on it, and a sink that has to switch
on twenty values is a sink nobody writes correctly.

## Correlation

Three scopes, deliberately distinct, and every API call carries all three as
`X-Request-Id`, `X-Session-Id` and `X-Trace-Id` — `correlationHeaders()`,
applied once in the API client rather than at each call site:

- **Request id** — one per API call, sent as `X-Request-Id`. A backend that
  echoes it into its own logs turns "the withdrawal list was empty at about half
  past two" into one grep.
- **Session id** — one per browser tab, for as long as that tab lives. It groups
  the requests of a single sitting without identifying the operator: the backend
  already knows who they are from the session cookie, and repeating it here
  would only spread the identity further.
- **Trace id** — one per journey. A navigation starts a new trace, so the calls
  a single screen fans out read as one unit. A trace that spanned the whole
  session would group everything and therefore explain nothing.

**These are not a fingerprint.** They are random per tab, reset when the tab
closes, never written to `localStorage`, and carry nothing derived from the
user, the device or the account. A shared branch workstation must not accumulate
a durable identifier that outlives the person using it.

## What must never be emitted

Attributes are diagnostic breadcrumbs, not a data dump. No account numbers, no
IBANs, no client names, no amounts, no search terms, no tokens, no anything an
operator typed. Route **names** rather than URLs, because a client profile URL
carries an id: `/ar/core/clients/cli_1000` is emitted as
`/core/clients/[id]`. That is a privacy rule and a cardinality rule at once — a
dashboard with one row per client is not a metric.

`assertSafeAttributes` rejects the obvious mistakes by key name in development.
It is a seatbelt, not a substitute for thinking; it cannot tell that
`attributes.ref` holds an IBAN.

## Web Vitals

`TelemetryProvider` forwards everything `next/web-vitals` reports — LCP, INP,
CLS, FCP, TTFB, plus Next's own hydration and render timings — as
`vital.<name>`, with `level: "warning"` when the metric's own rating is `poor`.

The point is not a number on a dashboard: "the dashboard is slow" is a report
about a device, a network and a branch, none of which reproduce at a developer's
desk. Field measurements do.

The budget those numbers are judged against — and the bundle budget the build
enforces — is in [PERFORMANCE.md](PERFORMANCE.md).

## Feature flags

Build-time, closed by default, enumerated.

```
NEXT_PUBLIC_FEATURE_FLAGS=telemetry,advancedAnalytics
```

- **Build-time, not runtime**, so the flag set is decided by whoever deploys and
  cannot be flipped by anyone holding a browser. A runtime service would be a
  nicer product and a worse security boundary.
- **Closed by default**, so a typo turns a feature off, never on.
- **Enumerated** in `KNOWN_FLAGS`, so `useFlag("whatever")` does not type-check —
  and so a reviewer has one list to read when hunting flags that outlived their
  rollout.

A flag is a UI decision, and **the UI is not a security boundary**. The backend
must enforce every rule a flag appears to relax.

## Build identity

`NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_SHA`, `NEXT_PUBLIC_BUILD_TIME` and
`NEXT_PUBLIC_ENVIRONMENT` are stamped at build time and shown in the footer as
`1.4.0 · a1b2c3d`. All four are non-fatal when absent: a developer running
`next dev` has no commit to stamp, and the app must not refuse to start over a
diagnostic. `env.ts` keeps the loud failures for values the app genuinely cannot
run without.

None of it is secret. A commit SHA and a build timestamp are visible in any
deployment's static assets; naming them makes support faster without telling an
attacker anything the bundle did not already say.

The full panel — build, environment, API mode, session id, flag states — is on
**Settings → System information**, and copies as plain text rather than JSON,
because it gets pasted into a ticket where JSON is something the reader has to
decode before they can help.

## What is not here

- **No RUM vendor, no session replay, no analytics SDK.** Session replay on a
  screen showing account numbers is a data-exfiltration channel with a support
  ticket attached. If one is ever wanted, it is a sink like any other — and the
  masking rules have to be designed first.
- **No server-side tracing.** The panel is the front end; spans that cross into
  the API are the backend's to emit and correlate, which is what `X-Request-Id`
  is for.
- **No alerting.** Thresholds, paging and dashboards belong to whatever consumes
  the sink. This repository's job is to emit something worth alerting on.

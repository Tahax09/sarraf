# ADR-0006 — Telemetry is a sink, not a vendor

- **Status:** accepted
- **Date:** 2026-08-07
- **Applies to:** `src/lib/observability/**`, `src/lib/report-error.ts`, `src/components/providers/telemetry-provider.tsx`

## Context

The panel had no production observability. When a branch reported that a
transfer screen froze, there was nothing to read: no error had left the browser,
no build identity was on screen, and no request could be tied to a backend log
line.

The obvious fix is to install Sentry. It is one package, one `init()`, and it
solves the error half of the problem the afternoon it lands. That is exactly why
it is worth writing down why this repository did something else.

Three constraints made the obvious fix the wrong one here:

1. **This is a banking back office.** Every screen holds account numbers, client
   names, IBANs and amounts. A vendor SDK that captures breadcrumbs, network
   payloads or DOM snapshots by default is a data-exfiltration channel that
   arrives switched on. Turning all of that off is possible, but the safe
   configuration is then a property of a config object that nobody re-reads.
2. **The deployment is not ours.** The panel is deployed by whoever runs the
   bank's infrastructure. They may already have an OpenTelemetry collector, or a
   policy that forbids sending anything to a third party, or no observability at
   all. A repository that hard-codes a destination has made that decision for
   them.
3. **A vendor SDK spreads.** `Sentry.captureException` in an error boundary is
   contained. `Sentry.addBreadcrumb` in a hook, `withSentry` around a fetch
   wrapper, and a `beforeSend` that has to know which fields are sensitive are
   not — and that is the shape these integrations actually reach after a year.

## Decision

The application emits typed events. A **sink** decides what becomes of them.

```ts
export type TelemetrySink = (record: TelemetryRecord) => void;
export function registerTelemetrySink(sink: TelemetrySink): () => void;
```

- Nothing under `src/` imports a vendor SDK, and the repository has no
  observability dependency.
- Application code calls `emit()` with a small, typed event —
  `kind: "navigation" | "vital" | "request" | "error" | "action"` — and never
  learns whether a sink is installed.
- Wiring a vendor is one registration at start-up. Wiring two is two
  registrations, because a deployment may want traces in one system and errors
  in another.
- **There is no default sink.** Until a deployment registers one, events are
  dropped after a development-mode console line.
- Attributes are checked against a forbidden-key pattern in development
  (`iban`, `account`, `token`, `amount`, `name`, `query`, …), and routes are
  emitted as names — `/core/clients/[id]` — never as URLs.

One exception is deliberate: `reportError()` also POSTs to the backend's
existing UI-event endpoint whether or not a sink exists. That endpoint already
receives sensitive-field reveal events, so it is a contract that exists rather
than one this repository invented, and it is the only destination that works in
a deployment that wired nothing.

## Consequences

**What this costs.** Out of the box, the panel reports nothing. Anyone expecting
`npm install` to produce a dashboard will be disappointed, and the first
deployment has to write ten lines of adapter. The event model is also ours: a
sink author maps `TelemetryRecord` onto their vendor's shape rather than getting
the vendor's native instrumentation for free, which means no automatic fetch
tracing, no automatic breadcrumbs, and no session replay.

**What it buys.** The privacy rule is enforced in one file instead of in a
vendor's configuration. The panel cannot accumulate an accidental dependency on
a specific observability product, because application code has no name for one.
Swapping vendors, or running two during a migration, does not touch a page, a
hook or a fetch wrapper. And a deployment that is not allowed to send anything
anywhere is a supported configuration rather than a fork.

**What it does not decide.** Thresholds, alerting and retention belong to
whatever consumes the sink. This repository's job is to emit something worth
alerting on.

## Alternatives considered

**Install Sentry directly.** Fastest to value, and the one most teams would
pick. Rejected because the default capture behaviour is wrong for this data, and
because the coupling is not reversible once `captureException` has spread past
the error boundaries.

**OpenTelemetry's browser SDK as the interface.** The right vocabulary, and the
one a collector already speaks — but it is a large dependency in a bundle that
is on a budget (see [PERFORMANCE.md](../PERFORMANCE.md)), and it commits every
deployment to OTel semantics whether or not they run a collector. A sink that
adapts to OTel in ten lines keeps the option without paying for it.

**A default sink posting to our own `/telemetry` endpoint.** Would make the
feature work out of the box, and would invent a backend contract nobody agreed
to. Rejected on the same grounds the whole repository follows: do not invent
backend APIs.

**Console logging in production.** Free, and useless — nobody reads a branch
workstation's console, and anything a page logs is readable by any script that
gets into the page.

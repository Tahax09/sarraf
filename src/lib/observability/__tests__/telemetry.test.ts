import {
  clearTelemetrySinks,
  emit,
  hasTelemetrySink,
  registerTelemetrySink,
  type TelemetryRecord,
} from "@/lib/observability/telemetry";
import {
  correlationHeaders,
  resetCorrelationIds,
  sessionId,
  startTrace,
  traceId,
} from "@/lib/observability/correlation";

/**
 * The contract a vendor adapter is written against. If any of this changes,
 * every deployment's observability wiring changes with it — which is why it is
 * pinned here rather than left to the one place it happens to be used.
 */
describe("telemetry", () => {
  beforeEach(() => {
    clearTelemetrySinks();
    resetCorrelationIds();
  });

  it("drops events when nothing is listening", () => {
    expect(hasTelemetrySink()).toBe(false);
    // The assertion is that this does not throw: an application with no sink
    // is the default state, not an error state.
    expect(() =>
      emit({ kind: "action", name: "noop", level: "info" }),
    ).not.toThrow();
  });

  it("stamps every event with correlation and release context", () => {
    const seen: TelemetryRecord[] = [];
    registerTelemetrySink((record) => seen.push(record));

    emit({ kind: "navigation", name: "route.opened", level: "info" });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      kind: "navigation",
      name: "route.opened",
      sessionId: sessionId(),
      traceId: traceId(),
    });
    expect(seen[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("delivers to every sink and survives one that throws", () => {
    const seen: string[] = [];
    registerTelemetrySink(() => {
      throw new Error("collector is down");
    });
    registerTelemetrySink((record) => seen.push(record.name));

    // A broken sink must not become a broken application, and must not stop
    // the sink registered after it from being called.
    expect(() =>
      emit({ kind: "error", name: "error.app", level: "error" }),
    ).not.toThrow();
    expect(seen).toEqual(["error.app"]);
  });

  it("stops delivering once a sink is unregistered", () => {
    const seen: string[] = [];
    const remove = registerTelemetrySink((record) => seen.push(record.name));

    emit({ kind: "action", name: "first", level: "info" });
    remove();
    emit({ kind: "action", name: "second", level: "info" });

    expect(seen).toEqual(["first"]);
  });
});

describe("correlation ids", () => {
  beforeEach(resetCorrelationIds);

  it("keeps the session id stable and gives each request its own", () => {
    const first = correlationHeaders();
    const second = correlationHeaders();

    expect(second["X-Session-Id"]).toBe(first["X-Session-Id"]);
    expect(second["X-Trace-Id"]).toBe(first["X-Trace-Id"]);
    // A shared request id would make the header useless for finding one call.
    expect(second["X-Request-Id"]).not.toBe(first["X-Request-Id"]);
  });

  it("starts a new trace per journey without disturbing the session", () => {
    const before = correlationHeaders();
    startTrace();
    const after = correlationHeaders();

    expect(after["X-Trace-Id"]).not.toBe(before["X-Trace-Id"]);
    expect(after["X-Session-Id"]).toBe(before["X-Session-Id"]);
  });

  it("carries nothing that could identify the operator", () => {
    // The ids are random hex. The test is here because the day someone
    // "improves" this by deriving it from the username is the day a shared
    // branch workstation grows a durable identifier.
    expect(sessionId()).toMatch(/^[0-9a-f]{16}$/);
  });
});

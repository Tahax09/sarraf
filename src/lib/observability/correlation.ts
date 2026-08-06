/**
 * Correlation identifiers — the thread that ties a screenshot to a log line.
 *
 * Three scopes, deliberately distinct:
 *
 * - **Request id** — one per API call. Sent as `X-Request-Id`; a backend that
 *   echoes it into its own logs turns "the withdrawal list was empty at about
 *   half past two" into one grep.
 * - **Session id** — one per browser tab, for as long as that tab lives. It
 *   groups the requests of a single sitting without identifying the operator:
 *   the backend already knows who they are from the session cookie, and
 *   repeating it here would only spread the identity further.
 * - **Trace id** — one per user journey (a navigation and everything it
 *   causes), so the calls a single screen fans out can be read as one unit.
 *
 * What these are **not**: a fingerprint. They are random per tab, reset when
 * the tab closes, never written to `localStorage`, and carry nothing derived
 * from the user, the device, or the account. A shared branch workstation must
 * not accumulate a durable identifier that outlives the person using it.
 */

/**
 * `crypto.randomUUID` is available in every browser this panel supports and in
 * Node 19+, but not in every test environment, so the fallback is real rather
 * than decorative. It is used for correlation only — never for anything
 * security-bearing, where a weak value would matter.
 */
function randomId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  if (cryptoRef?.getRandomValues) {
    const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

/** Shortened for log volume: 16 hex characters is ample for a day's requests. */
function shortId(): string {
  return randomId().replace(/-/g, "").slice(0, 16);
}

let sessionIdValue: string | null = null;
let traceIdValue: string | null = null;

/**
 * Stable for the life of the tab. Held in a module variable rather than
 * `sessionStorage`: a value that never has to be read by another frame does
 * not need to be written where another script could read it.
 */
export function sessionId(): string {
  sessionIdValue ??= shortId();
  return sessionIdValue;
}

/** The journey currently in flight. */
export function traceId(): string {
  traceIdValue ??= shortId();
  return traceIdValue;
}

/**
 * Starts a new journey. Called on navigation: the requests a screen makes
 * belong to the act of opening that screen, and a trace that spanned the whole
 * session would group everything and therefore explain nothing.
 */
export function startTrace(): string {
  traceIdValue = shortId();
  return traceIdValue;
}

/** A fresh id for one outbound request. */
export function requestId(): string {
  return shortId();
}

/**
 * Headers for an API call. Kept here rather than inline in the client so the
 * names are stated once — a backend team reading this file knows exactly what
 * to log without reading the fetch wrapper.
 */
export function correlationHeaders(): Record<string, string> {
  return {
    "X-Request-Id": requestId(),
    "X-Session-Id": sessionId(),
    "X-Trace-Id": traceId(),
  };
}

/** Test seam: resets tab-scoped ids so one test cannot observe another's. */
export function resetCorrelationIds(): void {
  sessionIdValue = null;
  traceIdValue = null;
}

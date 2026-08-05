/**
 * The single seam through which client-side errors leave the application.
 *
 * Nothing in this file talks to a vendor. It exists so that wiring Sentry (or
 * anything else) later is one edit in one place rather than a hunt through
 * every error boundary. Until then it forwards to the backend's UI event
 * endpoint, which already receives sensitive-field reveal events.
 *
 * Never pass user-entered values, account numbers, IBANs or tokens in
 * `context` — the payload is a diagnostic breadcrumb, not a data dump.
 */
import { apiFetch } from "@/lib/api/client";

export type ErrorContext = {
  /** Where the boundary sits: "global", "locale", "app", "route:<name>". */
  boundary: string;
  /** Next.js attaches this to errors it has already logged server-side. */
  digest?: string;
  /** Extra non-sensitive breadcrumbs (route name, query key, feature flag). */
  [key: string]: string | number | boolean | undefined;
};

/** Stable, human-quotable reference an operator can read out to support. */
export function errorReference(error: { digest?: string }): string {
  if (error.digest) return error.digest;
  // No digest means the throw never reached the server; synthesise something
  // short and stable enough for a screenshot.
  return Math.abs(Date.now() % 0xffffff)
    .toString(16)
    .padStart(6, "0");
}

export function reportError(error: unknown, context: ErrorContext): void {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "UnknownError", message: String(error) };

  if (process.env.NODE_ENV === "development") {
    // In development the developer is the audience; surface it immediately.
    console.error(`[${context.boundary}]`, error);
  }

  // Fire-and-forget. A failed report must never mask the original error or
  // throw a second one on top of it.
  void apiFetch<void>("/audit/ui-errors", {
    method: "POST",
    body: {
      ...context,
      name: normalized.name,
      message: normalized.message,
      // Stacks are minified in production and carry no user data, but they are
      // still capped so a runaway stack cannot bloat the request.
      stack: normalized.stack?.slice(0, 4000),
      pathname:
        typeof window === "undefined" ? undefined : window.location.pathname,
      at: new Date().toISOString(),
    },
  }).catch(() => {
    /* Reporting is best-effort by design. */
  });
}

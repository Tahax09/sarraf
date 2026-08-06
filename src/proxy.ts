import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing, locales } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? "saraf_session";

/** Paths reachable without a session, given without a locale prefix. */
const PUBLIC_PATHS = ["/login", "/forgot-password"];

function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  if ((locales as readonly string[]).includes(first)) {
    return "/" + rest.join("/");
  }
  return pathname;
}

/**
 * The API the browser is allowed to talk to. Read from the same environment
 * variable the client uses, so the policy cannot drift from the base URL the
 * app actually calls; an absent or malformed value contributes nothing and
 * leaves `connect-src 'self'`.
 */
function apiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return "";
  try {
    return new URL(base).origin;
  } catch {
    return "";
  }
}

/**
 * Per-request Content-Security-Policy.
 *
 * `script-src` carries a fresh nonce plus `'strict-dynamic'`, so only the
 * scripts Next.js itself emits can run — an injected `<script>` has no nonce
 * and no loader will pull it in. Every route here is already rendered per
 * request (the session check below sees to that), so requiring a nonce costs
 * no caching that the app was getting.
 *
 * `style-src-attr 'unsafe-inline'` is a deliberate, narrow exception: chart
 * heights and legend swatches are written as `style` attributes, which a nonce
 * cannot cover. Splitting the directive keeps `<style>` injection blocked
 * rather than relaxing all styles at once.
 */
/**
 * Cloudflare's challenge origin, and only where a site key is configured. The
 * widget draws itself in an iframe, which `script-src`'s `strict-dynamic` says
 * nothing about — without this the challenge is blocked and no one can sign in.
 */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const api = apiOrigin();
  const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    ? ` ${TURNSTILE_ORIGIN}`
    : "";

  return [
    "default-src 'self'",
    // 'unsafe-eval' in development only: React rebuilds server stacks with eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${api ? ` ${api}` : ""}${turnstile}`,
    `frame-src 'self'${turnstile}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Belt and braces with the X-Frame-Options header in next.config.ts.
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const bare = stripLocale(request.nextUrl.pathname) || "/";
  const isPublic = PUBLIC_PATHS.some(
    (p) => bare === p || bare.startsWith(`${p}/`),
  );

  if (!isPublic) {
    // Session lives in an httpOnly cookie set by the backend — never localStorage.
    const session = request.cookies.get(AUTH_COOKIE);
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      // Only the path and a reason code are carried over; never a token, never
      // PII. `reason` tells the operator why they are looking at a sign-in form
      // they did not ask for — a protected page was open and the session is no
      // longer valid.
      const params = new URLSearchParams({ reason: "session" });
      if (bare !== "/") params.set("from", bare);
      url.search = `?${params}`;
      return NextResponse.redirect(url);
    }
  }

  const nonce = crypto.randomUUID();
  const csp = contentSecurityPolicy(nonce);

  // The renderer reads the nonce back off the request headers and stamps it on
  // the framework's own script tags, so no component has to thread it through.
  // next-intl rewrites the request, and the rewrite carries whatever headers it
  // was handed — hence a copy of the request rather than a header set on the
  // response.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = intlMiddleware(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Skip API routes, Next internals and files with an extension.
      source: "/((?!api|_next|_vercel|.*\\..*).*)",
      // A prefetch renders no document, so it needs no policy of its own.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

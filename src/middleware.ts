import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing, locales } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? "saraf_session";

/** Paths reachable without a session, given without a locale prefix. */
const PUBLIC_PATHS = ["/login"];

function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  if ((locales as readonly string[]).includes(first)) {
    return "/" + rest.join("/");
  }
  return pathname;
}

export default function middleware(request: NextRequest) {
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
      // Only the path is carried over; never put tokens or PII in query strings.
      url.search = bare === "/" ? "" : `?from=${encodeURIComponent(bare)}`;
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Auto-memoization for every component the compiler can prove safe. The
   * alternative — hand-written `useMemo`/`useCallback` scattered through the
   * register pages — costs readability on every future edit and goes stale the
   * moment a dependency array is forgotten.
   *
   * Four form components using React Hook Form's `watch()` are skipped by the
   * compiler and say so at lint time; they are correct as written, just not
   * memoized.
   */
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            // Two years, subdomains included. `preload` is deliberately left
            // off: submitting to the preload list is a deployment decision
            // that is painful to reverse, and it belongs to whoever owns the
            // domain — see docs/SECURITY.md.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

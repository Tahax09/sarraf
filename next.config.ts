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
            /*
             * Every powerful feature is off, including the ones nothing here
             * asks for. A back office that never needs the camera should say
             * so, so that a dependency which starts asking is refused by the
             * platform rather than by a review that may not happen.
             *
             * `geolocation` used to be `(self)` for a branch-picker idea that
             * was never built.
             */
            key: "Permissions-Policy",
            value: [
              "accelerometer=()",
              "autoplay=()",
              "camera=()",
              "display-capture=()",
              "encrypted-media=()",
              "fullscreen=(self)",
              "geolocation=()",
              "gyroscope=()",
              "magnetometer=()",
              "microphone=()",
              "midi=()",
              "payment=()",
              "usb=()",
              "xr-spatial-tracking=()",
            ].join(", "),
          },
          {
            /*
             * Severs the window from anything it opens or is opened by, so a
             * page that links out cannot be reached back through
             * `window.opener`, and the browser can put this origin in its own
             * process. `X-Frame-Options` and `frame-ancestors` already refuse
             * framing; this covers the other direction.
             */
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            /*
             * Nothing here may be embedded by another origin as a subresource.
             * Not `same-origin`, which would also refuse the Turnstile iframe's
             * own resources; `same-site` is the strongest value that leaves the
             * challenge working.
             */
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

import { defineConfig, devices } from "@playwright/test";

/**
 * E2E covers the money-movement flows only — the places where a mistake moves
 * real funds. Both a desktop and a phone project run them: approvals happen on
 * phones, so the card fallback and the full-screen sheet are load-bearing.
 *
 * The dev server runs against fixtures; no real backend is contacted.
 */
// Next 16 allows one dev server per directory, so the suite runs on the
// project's own dev port and reuses a server that is already up. `login()`
// asserts it really reached Saraf, in case something else holds the port.
const PORT = Number(process.env.E2E_PORT ?? 3000);
// `localhost`, not 127.0.0.1: the Next dev server treats the numeric host as a
// cross-origin dev request and refuses to serve its chunks.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Fixture state is module-level and mutable, so one worker keeps runs honest.
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "ar-LY",
    timezoneId: "Africa/Tripoli",
    trace: "on-first-retry",
  },
  projects: [
    /*
     * The axe sweep is its own project rather than a spec the two device
     * projects both pick up. It visits every route in both catalogues, so
     * running it twice would double the longest job in CI to certify the same
     * markup: axe's rules are computed from the accessibility tree, and the
     * only AA criteria that actually change with the viewport — reflow and
     * target size — are the ones it cannot check mechanically. Those stay with
     * `responsive.spec.ts` and with the reviewer.
     */
    {
      name: "a11y",
      testMatch: /a11y\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop",
      testIgnore: /a11y\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testIgnore: /a11y\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_MODE: "fixtures",
      // Cloudflare's always-passes test key. A real site key is bound to its
      // domains, so one configured for a deployment would leave the sign-in
      // button disabled here and fail every spec at the first step.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      NEXT_PUBLIC_API_BASE_URL:
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.example.invalid",
    },
  },
});

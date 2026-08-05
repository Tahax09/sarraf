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
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_MODE: "fixtures",
      NEXT_PUBLIC_API_BASE_URL:
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.example.invalid",
    },
  },
});

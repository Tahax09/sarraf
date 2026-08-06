import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

/**
 * The JavaScript budget.
 *
 * Every register page in this panel is a client component, for the reason
 * recorded in `docs/adr/0005-the-panel-renders-in-the-browser.md`, so the size
 * of what a route ships is a number worth holding to account rather than an
 * implementation detail. This spec measures it the only way that is true of the
 * built application: from `PerformanceResourceTiming` in a real browser, on a
 * production build, counting the bytes actually transferred.
 *
 * It is skipped unless `E2E_PROD=1`, because the suite's default server is
 * `next dev`, whose unminified chunks would make any threshold meaningless.
 * `npm run perf:budget` builds, serves and runs it in one step.
 *
 * The thresholds are not aspirations. They sit above what the routes measure
 * today with room for ordinary growth, and they exist to catch the one class of
 * regression that unit tests never see: a heavy dependency pulled into the
 * shared graph, or a lazily-loaded one — recharts is ~400 kB — becoming eager.
 */

/** Total JS a route transfers, in kilobytes. */
const BUDGET_KB = 460;

/**
 * What every route pays before its own code. This is the framework, the design
 * system, the query client and the message catalogue; it is the number that
 * moves when a dependency lands in the shared graph, so it gets a tighter bound
 * than any single route.
 */
const BASELINE_BUDGET_KB = 300;

/** Routes chosen to bracket the range: the heaviest, and the lightest. */
const ROUTES: [string, string][] = [
  // Charts, a stat bar, three cards and a table — the most a page does here.
  ["dashboard", "/dashboard"],
  // The ledger: server paging, filter bar, export actions, scrolling table.
  ["all-operations", "/core/analytics/all-operations"],
  // Charts again, on a page that is otherwise plain.
  ["branch-cash-flow", "/core/analytics/branch-cash-flow"],
  // A register with a wizard behind it.
  ["withdrawal", "/core/withdrawal/list"],
  // The floor: a permission matrix, no table, no chart.
  ["roles", "/core/roles"],
];

/**
 * Bytes of JavaScript this document has pulled from `/_next/static`.
 *
 * `encodedBodySize` is what crossed the wire — compressed, which is what a
 * reader on a Libyan mobile connection actually waits for. Read after a full
 * navigation, so the timeline belongs to this route and not the one before it.
 */
async function jsBytes(page: Page, path: string): Promise<number> {
  await page.goto(path);
  await page.locator("main").first().waitFor({ state: "visible" });
  // Long enough for the route's queries to resolve and for anything they render
  // to fetch its own chunk; short enough that link prefetching for the sidebar
  // has not had time to dominate the figure.
  await page.waitForTimeout(1500);
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (entry): entry is PerformanceResourceTiming =>
          entry.name.includes("/_next/static/") && entry.name.endsWith(".js"),
      )
      .reduce((sum, entry) => sum + entry.encodedBodySize, 0),
  );
}

test.describe("JavaScript budget", () => {
  test.skip(
    process.env.E2E_PROD !== "1",
    "Measures a production build; run `npm run perf:budget`.",
  );

  test("no route ships more JavaScript than its budget", async ({ page }) => {
    await login(page);

    const measured: [string, number][] = [];
    for (const [name, path] of ROUTES) {
      measured.push([name, Math.round((await jsBytes(page, path)) / 1024)]);
    }

    // Printed whether or not the assertion holds: a run that passes is also the
    // record of where the routes sat on that day.
    console.log(
      `JS per route (KB):\n${measured
        .map(([name, kb]) => `  ${name.padEnd(20)} ${kb}`)
        .join("\n")}`,
    );

    const over = measured.filter(([, kb]) => kb > BUDGET_KB);
    expect(
      over,
      `over the ${BUDGET_KB} KB budget: ${over.map(([n, kb]) => `${n} at ${kb} KB`).join(", ")}`,
    ).toEqual([]);

    // The lightest route is the shared baseline plus almost nothing, so it is
    // the closest thing to a direct measurement of what every route carries.
    const byName = new Map(measured);
    const lightest = Math.min(...measured.map(([, kb]) => kb));
    expect(lightest).toBeLessThanOrEqual(BASELINE_BUDGET_KB);

    /*
     * Charts are lazy, and this is the assertion that keeps them that way.
     *
     * `charts/index.tsx` loads recharts (~400 kB) through `React.lazy`. An
     * eager `import` anywhere in the shared graph would put it on every route
     * in the panel, and the only visible symptom would be a slightly slower
     * page. Chunk filenames are content-hashed, so the code cannot be
     * recognised by name — but a chart route that costs no more than a
     * chartless one is a chart route whose charts came in the shared bundle.
     */
    const chartCost =
      (byName.get("branch-cash-flow") ?? 0) - (byName.get("roles") ?? 0);
    expect(
      chartCost,
      "chart code appears to have moved into the shared graph",
    ).toBeGreaterThan(50);
  });
});

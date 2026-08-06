import { test, expect, type ConsoleMessage } from "@playwright/test";
import { login, t, visible } from "./helpers";

/**
 * Read-only pages, checked for the two failures that never show up in unit
 * tests: a message key that resolves in the catalogue but not in the running
 * app, and a chart that throws on real fixture data.
 */
const pages = [
  "/dashboard",
  "/core/reports",
  "/core/analytics/all-operations",
  "/settings/address-management/countries",
];

/**
 * The dev-only overlay injects its own `<style>` elements, which the CSP
 * refuses — `style-src-elem`, sourced from `next-devtools`. Verified absent
 * from a production build (`next build && next start`: zero violations), so the
 * report is about the tooling around the app, not the app.
 */
function fromDevtools(message: ConsoleMessage): boolean {
  return (
    message.text().includes("Content Security Policy") &&
    message.location().url.includes("next-devtools")
  );
}

for (const path of pages) {
  test(`${path} renders without a console error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !fromDevtools(m)) errors.push(m.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    await login(page);
    await page.goto(path);
    // Not `networkidle`: a production build prefetches the RSC payload of every
    // link in the sidebar, and those responses are held open, so the network is
    // never idle on any page of this app. Waiting for the content and giving the
    // queries a moment to resolve is what the assertion actually needs.
    await page.locator("main").first().waitFor({ state: "visible" });
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });
}

test("the dashboard trend range switches from 30 to 90 days", async ({
  page,
}) => {
  await login(page);
  const group = page.getByRole("radiogroup", {
    name: t("dashboard.rangeLabel"),
  });
  await expect(group).toBeVisible();

  const ninety = group.getByRole("radio", { name: t("dashboard.rangeDays", { days: "90" }) });
  await ninety.click();
  await expect(ninety).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByText(t("dashboard.trendsRange", { days: "90" })),
  ).toBeVisible();
});

test("the countries register shows both names and a single plus", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings/address-management/countries");

  // `visible`: the desktop table and the phone card fallback both carry these.
  await expect(visible(page.getByText("Tunisia")).first()).toBeVisible();
  await expect(visible(page.getByText("+216")).first()).toBeVisible();
  await expect(page.getByText("++216")).toHaveCount(0);
});

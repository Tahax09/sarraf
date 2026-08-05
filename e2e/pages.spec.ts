import { test, expect } from "@playwright/test";
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

for (const path of pages) {
  test(`${path} renders without a console error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (error) => errors.push(String(error)));

    await login(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

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

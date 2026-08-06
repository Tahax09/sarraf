import { test, expect, type ConsoleMessage } from "@playwright/test";
import { labelRe, login, t, visible } from "./helpers";

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

  const ninety = group.getByRole("radio", {
    name: t("dashboard.rangeDays", { days: "90" }),
  });
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

/*
 * The account panel used to ask for page 1 of ten movements and render them
 * with no pager, under a stat bar announcing that the account had thirty-six —
 * a number the reader could not reach. It pages on the server now, and the
 * stat is taken from the first page and kept: "last activity" that walks
 * backwards as the reader turns pages is worse than no stat at all.
 */
test("the account panel pages its movements without disturbing the stat bar", async ({
  page,
}) => {
  await login(page);
  await page.goto("/core/accounts/acc_0_0");

  // The reference is the panel's primary column, so it is on screen in the
  // desktop table and in the phone's card fallback alike.
  const references = () => visible(page.getByText(/^LED-\d+$/)).allInnerTexts();
  await expect(visible(page.getByText(/^LED-\d+$/)).first()).toBeVisible();

  const stats = page.locator("dl").first();
  const statsBefore = await stats.innerText();
  const firstPage = await references();
  expect(firstPage.length).toBeGreaterThan(0);

  const pager = page.getByRole("navigation", { name: t("table.pagination") });
  await pager.getByRole("button", { name: t("common.next") }).click();

  // Every reference on the second page is one the first page did not hold, so
  // the register really asked the server rather than re-slicing what it had.
  await expect
    .poll(async () => {
      const next = await references();
      return next.length > 0 && next.every((ref) => !firstPage.includes(ref));
    })
    .toBe(true);

  expect(await stats.innerText()).toBe(statsBefore);
});

/*
 * Reading a day of business means comparing it with the one before, so the
 * report moves a day at a time without going through the native date picker.
 * Forward stops at today, because there is no report for tomorrow.
 */
test("the reports page steps a day at a time and comes back to today", async ({
  page,
}) => {
  await login(page);
  await page.goto("/core/reports");

  const picker = visible(page.getByLabel(labelRe("reports.pickDate")));
  await expect(picker).toBeVisible();
  const startOfDay = await picker.inputValue();

  // Exact: "today" is a substring of both "previous day" and "next day" in
  // Arabic — اليوم, اليوم السابق, اليوم التالي.
  const todayButton = page.getByRole("button", {
    name: t("reports.today"),
    exact: true,
  });
  const forward = page.getByRole("button", { name: t("reports.nextDay") });
  // The page opens on today, so neither "today" nor "next" has anywhere to go.
  await expect(todayButton).toBeDisabled();
  await expect(forward).toBeDisabled();

  await page.getByRole("button", { name: t("reports.previousDay") }).click();
  await expect(picker).not.toHaveValue(startOfDay);
  await expect(forward).toBeEnabled();

  await todayButton.click();
  await expect(picker).toHaveValue(startOfDay);
  await expect(todayButton).toBeDisabled();
});

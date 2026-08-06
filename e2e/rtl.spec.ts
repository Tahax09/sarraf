import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

/**
 * Direction certification.
 *
 * The panel's default locale is Arabic, so every page in this suite is already
 * being read right-to-left. What is asserted here is the part a screenshot does
 * not show: that the shell mirrors, that directional icons turn with it, and
 * that each cell of record data resolves its own direction instead of inheriting
 * the page's — the failure that turns a readable IBAN into a mangled one.
 */
const ROUTES = [
  "/dashboard",
  "/core/clients/list",
  "/core/accounts",
  "/core/accounts/acc_0_0",
  "/core/clients/cli_1000",
  "/core/external-transfer",
  "/core/analytics/all-operations",
  "/core/logs",
  "/settings/system-info",
];

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("main").first().waitFor({ state: "visible" }).catch(() => {});
  await page.waitForTimeout(400);
}

test("the shell is laid out right-to-left", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");
  await settle(page);

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");

  // The navigation sits on the reading-start edge, which in Arabic is the right
  // one. Asserted against the viewport rather than a class name: the layout is
  // built from logical properties, and this is what they are supposed to produce.
  const sidebar = await page
    .getByRole("complementary")
    .first()
    .boundingBox();
  const main = await page.locator("main").first().boundingBox();
  expect(sidebar).not.toBeNull();
  expect(main).not.toBeNull();
  // The whole navigation is past the content: mirrored, not merely offset.
  expect(sidebar!.x).toBeGreaterThanOrEqual(main!.x + main!.width - 1);
});

test("directional icons turn with the page", async ({ page }) => {
  await login(page);
  await page.goto("/core/accounts/acc_0_0");
  await settle(page);

  const flipped = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".rtl-flip")).map(
      (el) => getComputedStyle(el).transform,
    ),
  );
  expect(flipped.length).toBeGreaterThan(0);
  // `scaleX(-1)` — the only transform the rule applies.
  for (const transform of flipped) {
    expect(transform).toBe("matrix(-1, 0, 0, 1, 0, 0)");
  }
});

test("record values resolve their own direction", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const failures: string[] = [];
  for (const path of ROUTES) {
    await page.goto(path);
    await settle(page);

    // Any cell or definition value carrying Latin letters or digits is mixed
    // content in an Arabic page: it has to be isolated, or the punctuation at
    // its edges is resolved against the page and lands at the wrong end.
    const unisolated = await page.evaluate(() => {
      const out: string[] = [];
      const latin = /[A-Za-z0-9]/;
      for (const el of Array.from(document.querySelectorAll("td, dd"))) {
        const text = (el.textContent ?? "").trim();
        if (!text || !latin.test(text)) continue;
        const style = getComputedStyle(el);
        if (style.unicodeBidi.includes("isolate")) continue;
        out.push(`${style.unicodeBidi} "${text.slice(0, 40)}"`);
        if (out.length >= 5) break;
      }
      return out;
    });

    for (const entry of unisolated) failures.push(`${path}: ${entry}`);
  }

  expect(failures).toEqual([]);
});

/**
 * Isolation without direction. Isolating a value fixes where its edges are; it
 * must not also decide which way the value is laid out, because that decision
 * belongs to the locale. An Arabic page reads right-to-left down to the last
 * amount, and the English one reads left-to-right down to the last Arabic
 * client name — otherwise a single column changes alignment row by row
 * according to how each record happened to be typed.
 */
for (const { locale, prefix, dir } of [
  { locale: "ar", prefix: "", dir: "rtl" },
  { locale: "en", prefix: "/en", dir: "ltr" },
]) {
  test(`${locale}: every value is laid out ${dir}`, async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    const failures: string[] = [];
    for (const path of ROUTES) {
      await page.goto(`${prefix}${path}`);
      await settle(page);
      await expect(page.locator("html")).toHaveAttribute("dir", dir);

      const strays = await page.evaluate((expected) => {
        const out: string[] = [];
        // `.numeric` and `<bdi>` are the two isolation carriers; `td`/`dd` get
        // it from the element rule. All three inherit direction, none set it.
        const selector = "td, dd, bdi, .numeric";
        for (const el of Array.from(document.querySelectorAll(selector))) {
          const text = (el.textContent ?? "").trim();
          if (!text) continue;
          const style = getComputedStyle(el);
          if (style.direction === expected) continue;
          out.push(`<${el.tagName.toLowerCase()}> ${style.direction} "${text.slice(0, 40)}"`);
          if (out.length >= 5) break;
        }
        return out;
      }, dir);

      for (const entry of strays) failures.push(`${prefix}${path}: ${entry}`);
    }

    expect(failures).toEqual([]);
  });
}

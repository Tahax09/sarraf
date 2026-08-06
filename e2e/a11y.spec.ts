import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { login, PUBLIC_ROUTES, ROUTES, t, visible } from "./helpers";

/**
 * WCAG 2.2 AA, verified rather than asserted.
 *
 * The repository targets AA. Until this file existed that target rested on
 * inspection, which does not catch a contrast ratio that drifts by one token
 * edit or a landmark that stops being unique when a card is added. axe-core
 * catches roughly a third of AA mechanically — the third that regresses
 * silently — and the rest stays the reviewer's job. That split is stated in
 * `docs/ACCESSIBILITY.md`; nothing here should be read as full AA proof.
 *
 * Every route is swept, not a sample, because the violations that matter are
 * the ones on the page nobody thought to check.
 */

/** The tags that make up the AA target, including the 2.2 additions. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Cloudflare's widget draws inside a cross-origin iframe whose markup is not
 * ours to fix. Excluding the container keeps the rest of the sign-in page
 * honest instead of letting one un-actionable violation mask the others.
 */
const THIRD_PARTY = "[data-turnstile]";

function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(TAGS).exclude(THIRD_PARTY);
}

/** One line per violation, with the nodes, so a failure is actionable from CI logs. */
function report(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes
          .map((node) => `    ${node.target.join(" ")}`)
          .join("\n"),
    )
    .join("\n");
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .locator("main")
    .first()
    .waitFor({ state: "visible" })
    .catch(() => {});
  // Tables and charts mount after their query resolves; scanning before that
  // certifies a skeleton.
  await page.waitForTimeout(600);
}

// Both catalogues: an Arabic-only sweep would miss an English label that never
// got one, and an English-only sweep would miss the RTL layout entirely.
for (const locale of ["ar", "en"] as const) {
  for (const [name, path] of PUBLIC_ROUTES) {
    test(`${name} (${locale}) has no automatically detectable WCAG violations`, async ({
      page,
    }) => {
      await page.goto(`/${locale}${path}`);
      await settle(page);
      const results = await scan(page).analyze();
      expect(report(results), report(results)).toBe("");
    });
  }
}

test.describe("authenticated routes", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const [name, path] of ROUTES) {
    test(`${name} has no automatically detectable WCAG violations`, async ({
      page,
    }) => {
      await page.goto(path);
      await settle(page);
      const results = await scan(page).analyze();
      expect(report(results), report(results)).toBe("");
    });
  }

  /*
   * Overlays are scanned open, because that is the only state in which they
   * exist. A dialog is also the one place where a missing accessible name is
   * total rather than cosmetic: there is nothing else on screen to read.
   */
  test("an open dialog has no automatically detectable WCAG violations", async ({
    page,
  }) => {
    await page.goto("/core/system/currencies");
    await settle(page);
    await visible(page.getByRole("button", { name: t("currencies.add") }))
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const results = await scan(page).analyze();
    expect(report(results), report(results)).toBe("");
  });
});

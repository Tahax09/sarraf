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
   * WCAG 2.2 SC 2.4.11, Focus Not Obscured (Minimum) — the criterion axe-core
   * cannot check, because it is about geometry after a scroll rather than about
   * markup.
   *
   * The shell puts a `sticky top-0` header over every page and a `fixed` bottom
   * nav under every phone one. A keyboard user walking backwards up a long
   * register makes the browser scroll each field into view, and without
   * `scroll-padding` on the scrolling root it parks that field flush against the
   * top of the viewport — which is behind the header. The failure is invisible
   * to a mouse user and total for a keyboard one, so it is asserted rather than
   * reviewed.
   *
   * Backwards is the direction that fails: tabbing forwards scrolls an element
   * up from below, where nothing covers it.
   */
  for (const [label, viewport] of [
    ["desktop", { width: 1280, height: 720 }],
    // Below `lg` the bottom nav appears, and it covers the end of the page the
    // way the header covers the start.
    ["phone", { width: 390, height: 844 }],
  ] as const) {
    test(`no focused element hides behind the sticky chrome (${label})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      // The longest register in the app: enough rows to force the scroll that
      // exposes the defect, and a filter bar of real controls to land on.
      await page.goto("/core/analytics/all-operations");
      await settle(page);

      // Shift+Tab from an unfocused document walks in from the end of the page,
      // which is exactly the journey being certified.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const covered: string[] = [];
      for (let step = 0; step < 40; step += 1) {
        await page.keyboard.press("Shift+Tab");
        const hit = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;

          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return null;

          /*
           * Hit-testing rather than rectangle intersection, because the
           * criterion is about what the user can see, not about geometry: the
           * skip link overlaps the header on purpose and paints above it, and
           * an intersection test would call that a failure. Two points along
           * the top edge, which is the edge a sticky header eats.
           */
          const y = box.top + 2;
          for (const x of [box.left + box.width * 0.25, box.left + box.width * 0.75]) {
            const painted = document.elementFromPoint(x, y);
            if (!painted) continue;
            if (painted === el || el.contains(painted) || painted.contains(el)) {
              continue;
            }
            return `${el.tagName} at ${Math.round(box.top)} covered by ${painted.tagName}.${painted.className.toString().slice(0, 40)}`;
          }
          return null;
        });
        if (hit) covered.push(hit);
      }

      expect(covered, covered.join("\n")).toEqual([]);
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

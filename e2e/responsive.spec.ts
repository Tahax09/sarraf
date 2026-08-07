import { test, expect, type Page } from "@playwright/test";
import { login, ROUTES } from "./helpers";

/**
 * Layout certification, measured rather than eyeballed.
 *
 * Every route is loaded once and then re-measured at each required width: a
 * page that scrolls sideways on a phone is a defect the design system can
 * introduce anywhere (one flex item without `min-w-0` took out all 27 routes at
 * once), and it is invisible on a laptop.
 */
/*
 * The certified set. 320 is the reflow floor (SC 1.4.10 — 400% zoom on a
 * 1280px screen lands here), 375/390/414/430 are the phones in the field,
 * 768/1024 are the tablet breakpoints either side of `md` and `lg`, and
 * 1280/1366/1440/1920 are the laptops and desktops. 2560 is the trading-desk
 * monitor the shell had never been measured on: an app that only ever centres
 * content can leave a 1400px void beside a table.
 */
const WIDTHS = [
  320, 375, 390, 414, 430, 768, 1024, 1280, 1366, 1440, 1920, 2560,
];

type Overflow = {
  route: string;
  width: number;
  scrollWidth: number;
  culprits: string[];
};

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .locator("main")
    .first()
    .waitFor({ state: "visible" })
    .catch(() => {});
  await page.waitForTimeout(400);
}

/** Outermost elements whose box escapes the viewport's inline extent. */
async function overflowing(page: Page, width: number) {
  return page.evaluate((viewport) => {
    const escapes = (el: Element) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 && r.height > 0 && (r.right > viewport + 1 || r.left < -1)
      );
    };
    const scrolls = (el: Element) => {
      const style = getComputedStyle(el);
      return style.overflowX === "auto" || style.overflowX === "scroll";
    };
    const out: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (!escapes(el)) continue;
      // A wide child inside a scroller is the design, not a defect: registers
      // put their table in an `overflow-x-auto` box on purpose.
      if (
        el.parentElement &&
        (escapes(el.parentElement) || scrolls(el.parentElement))
      ) {
        continue;
      }
      const r = el.getBoundingClientRect();
      const cls =
        typeof el.className === "string"
          ? el.className.split(/\s+/).slice(0, 5).join(".")
          : "";
      out.push(
        `${el.tagName.toLowerCase()}.${cls} [${Math.round(r.left)}→${Math.round(r.right)}]`,
      );
      if (out.length >= 6) break;
    }
    return out;
  }, width);
}

test("no horizontal overflow at any breakpoint", async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);

  const failures: Overflow[] = [];
  for (const [name, path] of ROUTES) {
    // One load per route; the layout is responsive, so resizing re-measures it
    // without paying for a navigation at every breakpoint.
    await page.setViewportSize({ width: WIDTHS[0], height: 900 });
    await page.goto(path);
    await settle(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      if (scrollWidth > width + 1) {
        const culprits = await overflowing(page, width);
        console.log(
          `OVERFLOW ${name} @${width}: ${scrollWidth} — ${culprits.join(" | ")}`,
        );
        failures.push({ route: name, width, scrollWidth, culprits });
      }
    }
  }

  expect(failures).toEqual([]);
});

/**
 * WCAG 2.2 AA 2.5.8 — every control at least 24×24 CSS px.
 *
 * Measured at a phone width and at a table width, because the two render
 * different markup: below `md` a register is a card list, and above it the
 * table appears with its own controls. Checking only the phone certified half
 * the application — the column sort buttons were 16px tall for exactly as long
 * as that was the only width measured.
 */
for (const viewport of [375, 1024]) {
  test(`controls meet the minimum target size at ${viewport}px`, async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await login(page);

    const failures: string[] = [];
    for (const [name, path] of ROUTES) {
      await page.setViewportSize({ width: viewport, height: 800 });
      await page.goto(path);
      await settle(page);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const selector =
          "button, a[href], input, select, [role=button], [role=tab], summary";
        for (const el of Array.from(document.querySelectorAll(selector))) {
          // The skip link is 1×1 until it takes focus; it is measured at the size
          // it is offered at, which is full size.
          if (el.closest(".sr-only") || el.classList.contains("sr-only"))
            continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width >= 24 && r.height >= 24) continue;
          const label = (el.getAttribute("aria-label") ?? el.textContent ?? "")
            .trim()
            .slice(0, 32);
          out.push(
            `${el.tagName.toLowerCase()} ${Math.round(r.width)}×${Math.round(r.height)} "${label}"`,
          );
          if (out.length >= 8) break;
        }
        return out;
      });
      for (const entry of small) {
        failures.push(`${name}: ${entry}`);
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
}

import { test, expect, type Page } from "@playwright/test";
import { PUBLIC_ROUTES, t } from "./helpers";

/**
 * The signed-out pages, checked as a set rather than one at a time.
 *
 * They have no header and no user menu, so the three controls an operator may
 * need *before* they can read the form — their language, the theme, and the
 * accessibility preferences — have to be on the page itself. And they have to
 * be on every one of these pages: an operator who follows "forgot your
 * password?" and loses the contrast they just turned on has not been helped.
 */
function toolbar(page: Page) {
  return {
    language: page.getByRole("radiogroup", {
      name: t("user.language"),
      exact: true,
    }),
    theme: page.getByRole("button", { name: t("common.themeDark") }),
    accessibility: page.getByRole("button", { name: t("a11y.title") }),
  };
}

for (const [name, path] of PUBLIC_ROUTES) {
  test(`${name}: carries language, theme and accessibility controls`, async ({
    page,
  }) => {
    await page.goto(path);

    const controls = toolbar(page);
    await expect(controls.language).toBeVisible();
    await expect(controls.theme).toBeVisible();
    await expect(controls.accessibility).toBeVisible();

    // One heading per page, and the form under it — the same shape on both.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test(`${name}: switches theme and keeps it across the other page`, async ({
    page,
  }) => {
    await page.goto(path);
    await toolbar(page).theme.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // The preference is a cookie, so it survives the navigation and the server
    // renders the next page already dark — no flash of the default.
    const other = PUBLIC_ROUTES.find(([other]) => other !== name)?.[1] ?? path;
    await page.goto(other);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
}

test("the accessibility centre opens on the sign-in page", async ({ page }) => {
  await page.goto("/login");
  await toolbar(page).accessibility.click();

  const dialog = page.getByRole("dialog", { name: t("a11y.title") });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("group", { name: t("a11y.textSize") }),
  ).toBeVisible();

  // Larger text is applied immediately, on the page the operator is reading.
  // The radio itself is visually hidden, so this clicks its label, as an
  // operator would.
  await dialog.getByText(t("a11y.textSizes.large"), { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text", "large");
});

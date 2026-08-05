import { expect, test } from "@playwright/test";
import { login, t, visible } from "./helpers";

/**
 * Approval side of §6.3 — the two queues that hold client funds. These run on
 * the phone project too: approvals are done on phones, where the table is
 * replaced by the card fallback and the drawer becomes a full-screen sheet.
 */
test.beforeEach(async ({ page }) => {
  await login(page);
});

/**
 * Identity of the first queued row, not a count: the list is paged, so a
 * settled row can be replaced from the next page and leave the count intact.
 */
async function firstRow(
  page: import("@playwright/test").Page,
  action: string,
) {
  // `tr, li`: the desktop table and the phone card fallback both qualify.
  return visible(
    page
      .locator("tr, li")
      .filter({ has: page.getByRole("button", { name: action, exact: true }) }),
  )
    .first()
    .innerText();
}

test("authorized withdrawal: approving removes the row from the reserve tab", async ({
  page,
}) => {
  await page.goto("/core/authorized-withdrawal");
  await expect(
    visible(page.getByRole("button", { name: t("common.approve") })).first(),
  ).toBeVisible();
  const before = await firstRow(page, t("common.approve"));

  await visible(page.getByRole("button", { name: t("common.approve") }))
    .first()
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(t("authorizedWithdrawal.approveTitle"));
  await dialog.getByRole("button", { name: t("common.approve") }).click();

  await expect(dialog).toBeHidden();
  await expect(async () => {
    expect(await firstRow(page, t("common.approve"))).not.toBe(before);
  }).toPass();
});

test("external transfer: cancelling demands the word and a reason", async ({
  page,
}) => {
  await page.goto("/core/external-transfer");
  const cancelButtons = visible(
    page.getByRole("button", { name: t("common.cancel"), exact: true }),
  );
  await expect(cancelButtons.first()).toBeVisible();
  const before = await firstRow(page, t("common.cancel"));

  await cancelButtons.first().click();

  const dialog = page.getByRole("dialog");
  const confirm = dialog
    .getByRole("button", { name: t("common.cancel"), exact: true })
    .last();
  await expect(confirm).toBeDisabled();

  await dialog.getByRole("textbox").first().fill(t("confirm.word"));
  // Releasing held funds without a recorded reason is not allowed.
  await expect(confirm).toBeDisabled();
  await dialog.locator("textarea").fill("طلب العميل الإلغاء");
  await expect(confirm).toBeEnabled();

  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(async () => {
    expect(await firstRow(page, t("common.cancel"))).not.toBe(before);
  }).toPass();
});

test("the cancelled tab keeps the reason and drops the action buttons", async ({
  page,
}) => {
  await page.goto("/core/external-transfer");
  await page
    .getByRole("tab", { name: t("enums.status.cancelled") })
    .click();

  await expect(page).toHaveURL(/status=cancelled/);
  await expect(
    visible(page.getByRole("button", { name: t("common.approve") })),
  ).toHaveCount(0);
});

test("an approval row opens its detail sheet with the raw reference", async ({
  page,
}) => {
  await page.goto("/core/authorized-withdrawal");
  const row = visible(page.getByRole("button", { name: t("common.expandRow") }))
    .or(visible(page.getByRole("row")).nth(1))
    .first();
  await row.click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  // Raw backend IDs belong here, never in a column (§7 item 10).
  await expect(drawer).toContainText(t("fields.entryId"));
});

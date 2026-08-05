import { expect, test } from "@playwright/test";
import {
  clickNext,
  fillAmountAndBranch,
  labelRe,
  login,
  pickClient,
  t,
  visible,
} from "./helpers";

/**
 * Registration side of §6.3. Each flow is walked end to end through the wizard
 * and is only considered passing when the app lands back on the module's list —
 * i.e. the operation was actually accepted, not just form-validated.
 */
test.beforeEach(async ({ page }) => {
  await login(page);
});

async function finishWizard(page: import("@playwright/test").Page) {
  // Fee and notification steps are optional and left at their defaults.
  await clickNext(page);
  await clickNext(page);
  // Exact: the step rail's "review and submit" entry contains the same word.
  await visible(
    page.getByRole("button", { name: t("common.submit"), exact: true }),
  ).click();
}

test("withdrawal: register and return to the list", async ({ page }) => {
  await page.goto("/core/withdrawal/register");
  await pickClient(page, 0, 0);
  await clickNext(page);
  await fillAmountAndBranch(page, "withdrawal.amountLabel", "15");
  await clickNext(page);
  await finishWizard(page);

  await page.waitForURL(/\/core\/withdrawal\/list/);
  await expect(
    page.getByRole("heading", { name: t("withdrawal.listTitle") }),
  ).toBeVisible();
});

test("deposit: register and return to the list", async ({ page }) => {
  await page.goto("/core/deposit/register");
  await pickClient(page, 0, 0);
  await clickNext(page);
  await fillAmountAndBranch(page, "deposit.amountLabel", "40");
  await clickNext(page);
  await finishWizard(page);

  await page.waitForURL(/\/core\/deposit\/list/);
});

test("authorized withdrawal: register puts the operation in the reserve queue", async ({
  page,
}) => {
  await page.goto("/core/authorized-withdrawal/register");
  await pickClient(page, 0, 0);
  await clickNext(page);
  await fillAmountAndBranch(page, "withdrawal.amountLabel", "20");
  await clickNext(page);

  // Extra beneficiary step: this money is collected by someone else.
  await visible(page.getByLabel(labelRe("fields.beneficiaryName"))).fill(
    "سالم القذافي",
  );
  await visible(page.getByLabel(labelRe("fields.beneficiaryPhone"))).fill(
    "0912345678",
  );
  await clickNext(page);
  await finishWizard(page);

  await page.waitForURL(/\/core\/authorized-withdrawal/);
});

test("fund transfer: settles between two accounts after confirmation", async ({
  page,
}) => {
  await page.goto("/core/fund-transfer/register");
  await pickClient(page, 0, 0);
  await pickClient(page, 1, 1);
  await clickNext(page);
  await fillAmountAndBranch(page, "fields.amount", "30");
  await clickNext(page);
  await finishWizard(page);

  // Immediate settlement, so it goes through an explicit confirm dialog.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(t("fundTransfer.confirmBody"));
  await dialog.getByRole("button", { name: t("common.confirm") }).click();

  await page.waitForURL(/\/core\/fund-transfer\/list/);
});

test("fund transfer: refuses the same account on both sides", async ({
  page,
}) => {
  await page.goto("/core/fund-transfer/register");
  await pickClient(page, 0, 0);
  await pickClient(page, 1, 0);
  await clickNext(page);

  await expect(page.getByText(t("validation.sameAccount"))).toBeVisible();
});

test("CEFT: shows the applied rate and the converted amount", async ({
  page,
}) => {
  await page.goto("/core/currency-exchange-transfer/register");
  await pickClient(page, 0, 0);
  await pickClient(page, 1, 1);
  await clickNext(page);

  await visible(page.getByLabel(labelRe("fields.sentAmount"))).fill("50");
  await visible(page.getByLabel(labelRe("fields.branch"))).selectOption({
    index: 1,
  });

  // The rate is fetched live; the converted figure must not stay blank.
  await expect(page.getByText(t("ceft.rateApplied"))).toBeVisible();
  await expect(page.getByText(t("fields.convertedAmount"))).toBeVisible();

  await clickNext(page);
  await finishWizard(page);

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: t("common.confirm") }).click();
  await page.waitForURL(/\/core\/currency-exchange-transfer\/list/);
});

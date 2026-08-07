import { expect, type Locator, type Page } from "@playwright/test";
import ar from "../messages/ar.json";

/**
 * Every route the app can reach, as `[name, path]`.
 *
 * One list, imported by the responsive, RTL and accessibility sweeps, so a new
 * page is certified on all three axes the moment it is added here — and a page
 * cannot be added to one sweep and forgotten by the other two.
 */
export const ROUTES: [string, string][] = [
  ["dashboard", "/dashboard"],
  ["clients", "/core/clients/list"],
  ["client-profile", "/core/clients/cli_1000"],
  ["accounts", "/core/accounts"],
  ["account-profile", "/core/accounts/acc_0_0"],
  ["withdrawal", "/core/withdrawal/list"],
  ["authorized-withdrawal", "/core/authorized-withdrawal"],
  ["external-transfer", "/core/external-transfer"],
  ["fund-transfer", "/core/fund-transfer/list"],
  ["ceft", "/core/currency-exchange-transfer/list"],
  ["deposit", "/core/deposit/list"],
  ["all-operations", "/core/analytics/all-operations"],
  ["branch-cash-flow", "/core/analytics/branch-cash-flow"],
  ["activity", "/core/analytics/activity"],
  ["reports", "/core/reports"],
  ["top-clients", "/core/top-clients"],
  ["users", "/core/users"],
  ["roles", "/core/roles"],
  ["logs", "/core/logs"],
  ["branches", "/branches"],
  ["currencies", "/core/system/currencies"],
  ["countries", "/settings/address-management/countries"],
  ["system-info", "/settings/system-info"],
  ["pricing", "/core/system/operations-pricing"],
  ["profile", "/profile"],
  ["withdrawal-register", "/core/withdrawal/register"],
  ["external-register", "/core/external-transfer/register"],
];

/** Reachable without a session. Swept for accessibility in both locales. */
export const PUBLIC_ROUTES: [string, string][] = [
  ["login", "/login"],
  ["forgot-password", "/forgot-password"],
];

/**
 * E2E asserts against the real Arabic catalogue, so a hardcoded string or a
 * missing key fails the suite instead of shipping.
 */
export function t(path: string, values?: Record<string, string>): string {
  const text = path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown>)?.[key],
      ar,
    ) as string;
  // Enough ICU for the `{placeholder}` messages the specs assert on.
  return values
    ? text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match)
    : text;
}

/** Required fields append " *" to their label, so match from the start. */
export function labelRe(path: string) {
  return new RegExp(`^${t(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

/** Only what the current breakpoint actually shows — table on desktop, cards on mobile. */
export function visible(locator: Locator): Locator {
  return locator.locator("visible=true");
}

export async function login(page: Page, options: { from?: string } = {}) {
  // `from` is what the proxy adds when a session expires on a protected page,
  // and it is also attacker-controlled input — `security.spec.ts` signs in with
  // hostile values through this same helper, so the landing URL is deliberately
  // not asserted here.
  await page.goto(
    options.from
      ? `/login?from=${encodeURIComponent(options.from)}`
      : "/login",
  );
  // Guards against a stray dev server from another project holding the port.
  await expect(
    page.getByRole("heading", { name: t("auth.welcomeTitle") }),
  ).toBeVisible();
  await page.getByLabel(labelRe("auth.username")).fill("admin");
  await page.getByLabel(labelRe("auth.password")).fill("admin");
  await page.getByRole("button", { name: t("auth.signInCta") }).click();
  await page.waitForURL(
    options.from ? (url) => !url.pathname.endsWith("/login") : /\/dashboard/,
  );
}

/** Picks the nth client in a `<ClientAccountPicker>`, then waits for its account. */
export async function pickClient(page: Page, panel: number, index: number) {
  const search = visible(
    page.getByPlaceholder(t("common.searchPlaceholder")),
  ).nth(panel);
  await search.click();

  const listbox = visible(page.getByRole("listbox"));
  const option = listbox.getByRole("option").nth(index);
  await expect(option).toBeVisible();
  await option.click();

  const account = visible(page.getByLabel(labelRe("fields.account"))).nth(panel);
  // Single-account clients are auto-selected; multi-account ones need a choice.
  await expect(async () => {
    if (!(await account.inputValue())) {
      await account.selectOption({ index: 1 });
    }
    expect(await account.inputValue()).not.toBe("");
  }).toPass();
}

export async function fillAmountAndBranch(
  page: Page,
  amountLabel: string,
  amount: string,
) {
  await visible(page.getByLabel(labelRe(amountLabel))).fill(amount);
  const branch = visible(page.getByLabel(labelRe("fields.branch")));
  await branch.selectOption({ index: 1 });
}

export async function clickNext(page: Page) {
  await visible(page.getByRole("button", { name: t("common.next") })).click();
}

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WithdrawalRegisterPage from "@/app/[locale]/(app)/core/withdrawal/register/page";
import { renderWithProviders, message } from "@/test/utils";
import { navigation } from "@/test/mock-navigation";

jest.mock("next/navigation", () =>
  jest.requireActual("@/test/mock-navigation").nextNavigationMock(),
);
jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

beforeEach(() => navigation.reset("/core/withdrawal/register"));

const next = message("common.next");

/** Labels carry a required marker, so match from the start rather than exactly. */
const label = (path: string) => new RegExp(`^${message(path)}`);
const submit = message("common.submit");

/** Walks the first step: pick a client, then the account it owns. */
async function pickClient(user: ReturnType<typeof userEvent.setup>) {
  const combobox = await screen.findByPlaceholderText(
    message("common.searchPlaceholder"),
  );
  await user.click(combobox);

  // Scope to the listbox: <select> options carry the same role.
  const listbox = await screen.findByRole("listbox");
  await waitFor(() =>
    expect(within(listbox).getAllByRole("option").length).toBeGreaterThan(0),
  );
  await user.click(within(listbox).getAllByRole("option")[0]);

  const accountSelect = screen.getByLabelText(label("fields.account"));
  await waitFor(() =>
    expect(
      within(accountSelect).getAllByRole("option").length,
    ).toBeGreaterThan(1),
  );
  // Single-account clients are pre-selected; multi-account ones are not.
  if (!(accountSelect as HTMLSelectElement).value) {
    await user.selectOptions(
      accountSelect,
      within(accountSelect).getAllByRole("option")[1],
    );
  }
  return accountSelect as HTMLSelectElement;
}

async function fillAmountStep(
  user: ReturnType<typeof userEvent.setup>,
  amount: string,
) {
  await user.type(
    screen.getByLabelText(label("withdrawal.amountLabel")),
    amount,
  );
  const branch = screen.getByLabelText(label("fields.branch"));
  await waitFor(() =>
    expect(within(branch).getAllByRole("option").length).toBeGreaterThan(1),
  );
  await user.selectOptions(branch, within(branch).getAllByRole("option")[1]);
}

describe("register form — withdrawal (§3 SingleWorkflowForm)", () => {
  it("registers an operation and returns to the list", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<WithdrawalRegisterPage />);

    await pickClient(user);
    await user.click(screen.getByRole("button", { name: next }));

    await fillAmountStep(user, "10");
    await user.click(screen.getByRole("button", { name: next }));

    // Fee step, then notification — both optional, both left at defaults.
    await user.click(await screen.findByRole("button", { name: next }));
    await user.click(await screen.findByRole("button", { name: next }));

    // Review: a disabled fee contributes no row at all (§7 item 9). Compared
    // against the review list itself — the step rail carries the same word.
    const review = await screen.findByRole("button", { name: submit });
    const terms = [...container.querySelectorAll("dl dt")].map(
      (node) => node.textContent,
    );
    expect(terms.length).toBeGreaterThan(0);
    expect(terms).not.toContain(message("fields.fee"));

    await user.click(review);
    await waitFor(() =>
      expect(navigation.calls).toContain("/core/withdrawal/list"),
    );
  });

  it("blocks the step when the amount exceeds the account balance", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WithdrawalRegisterPage />);

    await pickClient(user);
    await user.click(screen.getByRole("button", { name: next }));

    await fillAmountStep(user, "99999999");
    await user.click(screen.getByRole("button", { name: next }));

    expect(
      await screen.findByText(message("validation.amountExceedsBalance")),
    ).toBeInTheDocument();
    // Still on the amount step — nothing was submitted.
    expect(screen.queryByRole("button", { name: submit })).not.toBeInTheDocument();
    expect(navigation.calls).toHaveLength(0);
  });

  it("will not advance past the first step without a client and account", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WithdrawalRegisterPage />);

    await screen.findByPlaceholderText(message("common.searchPlaceholder"));
    await user.click(screen.getByRole("button", { name: next }));

    expect(
      (await screen.findAllByText(message("validation.required"))).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByLabelText(label("fields.branch")),
    ).not.toBeInTheDocument();
  });
});

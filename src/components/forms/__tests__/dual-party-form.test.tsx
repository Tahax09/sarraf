import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FundTransferRegisterPage from "@/app/[locale]/(app)/core/fund-transfer/register/page";
import { renderWithProviders, message } from "@/test/utils";
import { navigation } from "@/test/mock-navigation";

jest.mock("next/navigation", () =>
  jest.requireActual("@/test/mock-navigation").nextNavigationMock(),
);
jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

beforeEach(() => navigation.reset("/core/fund-transfer/register"));

const next = message("common.next");
const submit = message("common.submit");
const label = (path: string) => new RegExp(`^${message(path)}`);

type User = ReturnType<typeof userEvent.setup>;

/** `panel` is 0 for the sender picker, 1 for the receiver. */
async function pickParty(user: User, panel: 0 | 1, clientIndex: number) {
  const combobox = (
    await screen.findAllByPlaceholderText(message("common.searchPlaceholder"))
  )[panel];
  await user.click(combobox);

  const listbox = await screen.findByRole("listbox");
  await waitFor(() =>
    expect(within(listbox).getAllByRole("option").length).toBeGreaterThan(
      clientIndex,
    ),
  );
  await user.click(within(listbox).getAllByRole("option")[clientIndex]);

  // The picker asks for that client's accounts only once a client is chosen, so
  // the sole-account auto-selection lands a tick later. The balance readout is
  // the signal that this panel has settled on an account.
  await waitFor(() =>
    expect(
      screen.getAllByText(message("fields.availableBalance")),
    ).toHaveLength(panel + 1),
  );
}

describe("register form — fund transfer (§3 DualPartyForm)", () => {
  it("moves money between two accounts after an explicit confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FundTransferRegisterPage />);

    await pickParty(user, 0, 0);
    await pickParty(user, 1, 1);
    await user.click(screen.getByRole("button", { name: next }));

    await user.type(screen.getByLabelText(label("fields.amount")), "25");
    const branch = screen.getByLabelText(label("fields.branch"));
    await waitFor(() =>
      expect(within(branch).getAllByRole("option").length).toBeGreaterThan(1),
    );
    await user.selectOptions(branch, within(branch).getAllByRole("option")[1]);
    await user.click(screen.getByRole("button", { name: next }));

    // Fee, then notification — both left at their defaults.
    await user.click(await screen.findByRole("button", { name: next }));
    await user.click(await screen.findByRole("button", { name: next }));
    await user.click(await screen.findByRole("button", { name: submit }));

    // Fund transfer settles immediately, so it is gated behind a confirmation.
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(message("fundTransfer.confirmBody")),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: message("common.confirm") }),
    );

    await waitFor(() =>
      expect(navigation.calls).toContain("/core/fund-transfer/list"),
    );
  });

  it("refuses a transfer where sender and receiver are the same account", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FundTransferRegisterPage />);

    await pickParty(user, 0, 0);
    await pickParty(user, 1, 0);
    await user.click(screen.getByRole("button", { name: next }));

    expect(
      await screen.findByText(message("validation.sameAccount")),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(label("fields.amount")),
    ).not.toBeInTheDocument();
  });
});

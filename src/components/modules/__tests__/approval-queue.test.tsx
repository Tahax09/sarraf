import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthorizedWithdrawalPage from "@/app/[locale]/(app)/core/authorized-withdrawal/page";
import { renderWithProviders, message } from "@/test/utils";
import { navigation } from "@/test/mock-navigation";

jest.mock("next/navigation", () =>
  jest.requireActual("@/test/mock-navigation").nextNavigationMock(),
);
jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

beforeEach(() => navigation.reset("/core/authorized-withdrawal"));

const approveLabel = message("common.approve");
const cancelLabel = message("common.cancel");
const confirmWord = message("confirm.word");

/** Rows of the reserve tab, excluding the header row. */
async function reserveRows() {
  const table = await screen.findByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

/**
 * The first row's text. Counting rows proves nothing once the table pages: a
 * settled row is replaced from the next page, so the count stays put.
 */
async function firstRowText() {
  return (await reserveRows())[0].textContent ?? "";
}

function dialog() {
  return screen.getByRole("dialog");
}

describe("approval queue — money movement (§6.3)", () => {
  it("approves a held operation and drops it out of the reserve tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthorizedWithdrawalPage />);

    const before = await reserveRows();
    const settled = await firstRowText();

    await user.click(
      within(before[0]).getByRole("button", { name: approveLabel }),
    );

    // Approval is gated behind an explicit confirmation, never a bare click.
    const confirm = within(dialog()).getByRole("button", {
      name: approveLabel,
    });
    await user.click(confirm);

    await waitFor(async () => {
      expect(await firstRowText()).not.toBe(settled);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("refuses to cancel until the word is typed and a reason is given", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthorizedWithdrawalPage />);

    const before = await reserveRows();
    const settled = await firstRowText();
    await user.click(
      within(before[0]).getByRole("button", { name: cancelLabel }),
    );

    // Footer holds [close, confirm]; both read "cancel" here by design.
    const buttons = within(dialog()).getAllByRole("button", {
      name: cancelLabel,
    });
    const confirm = buttons[buttons.length - 1];
    expect(confirm).toBeDisabled();

    // [0] is the type-to-confirm input, [1] the reason textarea.
    await user.type(within(dialog()).getAllByRole("textbox")[0], confirmWord);
    // Still blocked: cancelling releases held funds, so a reason is mandatory.
    expect(confirm).toBeDisabled();

    await user.type(
      within(dialog()).getByLabelText(
        new RegExp(message("authorizedWithdrawal.cancelReason")),
      ),
      "طلب العميل",
    );
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    await waitFor(async () => {
      expect(await firstRowText()).not.toBe(settled);
    });
  });

  it("hides the expiry and action columns outside the reserve tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthorizedWithdrawalPage />);
    await reserveRows();

    await user.click(
      screen.getByRole("tab", { name: message("enums.status.confirmed") }),
    );

    const table = await screen.findByRole("table");
    await waitFor(() => {
      expect(
        within(table).queryByRole("button", { name: approveLabel }),
      ).not.toBeInTheDocument();
    });
    expect(
      within(table).queryByRole("columnheader", {
        name: message("fields.expiresAt"),
      }),
    ).not.toBeInTheDocument();
  });
});

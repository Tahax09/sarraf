import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CountriesPage from "@/app/[locale]/(app)/settings/address-management/countries/page";
import { renderWithProviders, message } from "@/test/utils";

/** Rows of the register, header excluded. */
async function rows() {
  const table = await screen.findByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

describe("countries register (Round 2 §6)", () => {
  it("prints one plus sign in front of the dial code", async () => {
    renderWithProviders(<CountriesPage />);
    const table = within(await screen.findByRole("table"));
    expect(await table.findByText("+216")).toBeInTheDocument();
    expect(table.queryByText("++216")).not.toBeInTheDocument();
  });

  it("shows the English name in its own column", async () => {
    renderWithProviders(<CountriesPage />);
    const table = within(await screen.findByRole("table"));
    expect(
      screen.getByRole("columnheader", { name: message("countries.nameEn") }),
    ).toBeInTheDocument();
    expect(await table.findByText("Tunisia")).toBeInTheDocument();
    // The Arabic name stays its own column rather than sharing a cell.
    expect(table.getByText("تونس")).toBeInTheDocument();
  });

  it("filters the register by continent", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await rows();

    await user.selectOptions(
      screen.getByLabelText(message("countries.continent")),
      message("enums.continent.europe"),
    );

    await waitFor(async () => {
      const names = (await rows()).map((row) => row.textContent ?? "");
      expect(names.some((text) => text.includes("Germany"))).toBe(true);
      expect(names.some((text) => text.includes("Tunisia"))).toBe(false);
    });
  });

  it("adds a country through the dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await rows();

    await user.click(screen.getByRole("button", { name: message("countries.add") }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText(message("countries.nameAr"), { exact: false }), "الأردن");
    await user.type(dialog.getByLabelText(message("countries.nameEn"), { exact: false }), "Jordan");
    await user.type(dialog.getByLabelText(message("countries.code"), { exact: false }), "JO");
    // Digits only — the form never stores the `+`.
    await user.type(dialog.getByLabelText(message("countries.phoneCode"), { exact: false }), "962");
    await user.selectOptions(
      dialog.getByLabelText(message("countries.continent"), { exact: false }),
      message("enums.continent.asia"),
    );
    await user.click(dialog.getByRole("button", { name: message("common.save") }));

    // The new row lands at the end of the register, so search for it rather
    // than paging: the table shows ten rows at a time.
    await user.type(screen.getByLabelText(message("common.search")), "Jordan");
    const table = within(await screen.findByRole("table"));
    expect(await table.findByText("Jordan")).toBeInTheDocument();
    expect(table.getByText("+962")).toBeInTheDocument();
  });

  it("blocks removal of a country an external transfer names", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    await user.type(screen.getByLabelText(message("common.search")), "Tunisia");
    const table = within(await screen.findByRole("table"));
    const tunisia = (await table.findByText("Tunisia")).closest("tr")!;

    await user.click(
      within(tunisia).getByRole("button", { name: message("common.delete") }),
    );

    // The usage question is asked about this one country, so the answer only
    // arrives once the dialog is open.
    const dialog = within(screen.getByRole("dialog"));
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      message("countries.deleteBlocked"),
    );
    await waitFor(() => {
      expect(
        dialog.getByRole("button", { name: message("common.delete") }),
      ).toBeDisabled();
    });
  });

  it("gates removal behind the typed confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CountriesPage />);
    // Australia is in no transfer, so its row is the one that can be removed.
    await user.type(screen.getByLabelText(message("common.search")), "Australia");
    const table = within(await screen.findByRole("table"));
    const removable = (await table.findByText("Australia")).closest("tr")!;

    await user.click(
      within(removable).getByRole("button", { name: message("common.delete") }),
    );
    const dialog = within(screen.getByRole("dialog"));
    const confirm = dialog.getByRole("button", { name: message("common.delete") });
    expect(confirm).toBeDisabled();

    await user.type(dialog.getByRole("textbox"), message("confirm.word"));
    expect(confirm).toBeEnabled();
  });
});

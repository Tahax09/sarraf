import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "@/components/shared/filter-bar";
import { useFilters, type FilterDef } from "@/lib/filters";
import { renderWithProviders, message } from "@/test/utils";

const DEFS: FilterDef[] = [
  {
    key: "level",
    type: "select",
    label: "Level",
    options: [
      { value: "error", label: "Error" },
      { value: "info", label: "Info" },
    ],
  },
  { key: "date", type: "dateRange", label: "Date" },
  { key: "amount", type: "amountRange", label: "Amount" },
];

function Harness({
  persistKey,
  defs = DEFS,
}: {
  persistKey?: string;
  defs?: FilterDef[];
}) {
  const filters = useFilters(defs, { persistKey });
  return (
    <>
      <FilterBar defs={defs} state={filters} />
      <pre data-testid="params">{JSON.stringify(filters.params)}</pre>
    </>
  );
}

const params = () => JSON.parse(screen.getByTestId("params").textContent ?? "{}");

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("FilterBar", () => {
  it("sends the selected value as a request parameter", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.selectOptions(screen.getByLabelText("Level"), "error");
    expect(params()).toEqual({ level: "error" });
  });

  it("splits a range into the two parameters the backend takes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(
      screen.getByLabelText(message("filters.minAmount")),
      "100",
    );
    await user.type(screen.getByLabelText(message("filters.maxAmount")), "500");

    expect(params()).toEqual({ amountMin: "100", amountMax: "500" });
  });

  it("shows a chip per active filter and clears just that one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.selectOptions(screen.getByLabelText("Level"), "error");
    await user.type(screen.getByLabelText(message("filters.minAmount")), "100");

    await user.click(
      screen.getByRole("button", {
        name: message("filters.remove", { name: "Level: Error" }),
      }),
    );

    // The amount stays: a chip clears its own filter, not the whole set.
    expect(params()).toEqual({ amountMin: "100" });
  });

  it("clears everything at once", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.selectOptions(screen.getByLabelText("Level"), "error");
    await user.type(screen.getByLabelText(message("filters.minAmount")), "100");

    await user.click(
      screen.getAllByRole("button", { name: message("filters.clearAll") })[0],
    );
    expect(params()).toEqual({});
  });

  it("keeps the selection for the session when the register asks for it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Harness persistKey="logs-test" />);

    await user.selectOptions(screen.getByLabelText("Level"), "info");
    unmount();

    renderWithProviders(<Harness persistKey="logs-test" />);
    // An operator who opens a record and comes back should not filter again.
    expect(params()).toEqual({ level: "info" });
  });

  it("forgets the selection when no persistence key is given", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Harness />);

    await user.selectOptions(screen.getByLabelText("Level"), "info");
    unmount();

    renderWithProviders(<Harness />);
    expect(params()).toEqual({});
  });

  it("drops a stored value whose filter the page no longer offers", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Harness persistKey="shrink" />);

    await user.selectOptions(screen.getByLabelText("Level"), "error");
    unmount();

    // The register shipped without its level filter; the stale session value
    // must not keep constraining the request invisibly.
    renderWithProviders(<Harness persistKey="shrink" defs={[DEFS[1]]} />);
    expect(params()).toEqual({});
  });

  it("offers the controls behind a counted button on a phone", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.selectOptions(screen.getByLabelText("Level"), "error");
    expect(
      screen.getByRole("button", {
        name: message("filters.showWithCount", { count: "1" }),
      }),
    ).toBeInTheDocument();
  });
});

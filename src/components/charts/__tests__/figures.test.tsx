import { screen, within } from "@testing-library/react";
import {
  CategoryBarChart,
  CompositionDonut,
  TrendAreaChart,
  TrendLineChart,
} from "@/components/charts/charts";
import { renderWithProviders, message } from "@/test/utils";

/**
 * The drawing surface is `aria-hidden`, so this table is the whole of what a
 * screen reader gets from a chart. It is generated from the same props that
 * were drawn, and these tests are what stops it from quietly becoming optional
 * again — the previous escape hatch was a `summary` prop that no call site ever
 * passed, which made every chart on the product unreadable while looking
 * handled.
 *
 * The components are imported from `./charts` rather than the lazy `./index`
 * barrel: `Suspense` would resolve to the placeholder under jsdom.
 */

const TREND = [
  { date: "2026-01-01", deposits: 1200, withdrawals: 300 },
  { date: "2026-01-02", deposits: 800, withdrawals: 950 },
];

const MIX = [
  { currency: "LYD", operations: 40 },
  { currency: "USD", operations: 12 },
];

/** The figures table, wherever it sits in the frame. */
function figures() {
  return screen.getByRole("table", {
    name: message("charts.dataTableFallback"),
  });
}

function rowFor(label: string) {
  return screen.getByRole("row", { name: new RegExp(label) });
}

describe("chart figures", () => {
  it("gives a bar chart's series a row per category", () => {
    renderWithProviders(
      <CategoryBarChart
        data={TREND}
        xKey="date"
        series={[
          { key: "deposits", label: "Deposits", color: "red" },
          { key: "withdrawals", label: "Withdrawals", color: "blue" },
        ]}
      />,
    );

    const table = figures();
    expect(
      within(table).getByRole("columnheader", { name: "Deposits" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Withdrawals" }),
    ).toBeInTheDocument();

    const row = rowFor("2026-01-02");
    expect(within(row).getByText("950")).toBeInTheDocument();
  });

  it("labels rows with the same text the tooltip would have shown", () => {
    renderWithProviders(
      <TrendLineChart
        data={[{ day: 1, netFlow: 500 }]}
        xKey="day"
        series={[{ key: "netFlow", label: "Net flow", color: "green" }]}
        tooltipLabel={(value) => `Day ${String(value)} — 1 January`}
      />,
    );

    // Not "1": the reader gets the date, exactly as a hovering mouse would.
    expect(rowFor("1 January")).toBeInTheDocument();
  });

  it("names each slice of a donut", () => {
    renderWithProviders(
      <CompositionDonut data={MIX} nameKey="currency" valueKey="operations" />,
    );

    const table = figures();
    expect(within(table).getByText("LYD")).toBeInTheDocument();
    expect(within(table).getByText("40")).toBeInTheDocument();
  });

  it("names the single series of an area chart", () => {
    renderWithProviders(
      <TrendAreaChart
        data={[{ date: "2026-01-01", netFlow: -25 }]}
        dataKey="netFlow"
        label="Net flow"
        color="green"
      />,
    );

    expect(
      within(figures()).getByRole("columnheader", { name: "Net flow" }),
    ).toBeInTheDocument();
  });

  it("stays quiet when a visible table on the card already lists the figures", () => {
    renderWithProviders(
      <CompositionDonut
        data={MIX}
        nameKey="currency"
        valueKey="operations"
        figures="adjacent"
      />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says nothing at all rather than an empty table when there is no data", () => {
    renderWithProviders(
      <CategoryBarChart
        data={[]}
        xKey="date"
        series={[{ key: "deposits", label: "Deposits", color: "red" }]}
      />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(message("charts.noData"))).toBeInTheDocument();
  });
});

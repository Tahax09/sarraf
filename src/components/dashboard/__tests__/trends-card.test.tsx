import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrendsCard } from "@/components/dashboard/trends-card";
import { renderWithProviders, message } from "@/test/utils";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

jest.mock("@/lib/use-permission", () => ({
  usePermission: () => ({ ready: true, failed: false, can: () => true }),
}));

// The drawing surface needs a real layout to render; the section's controls,
// the series it hands the chart, and its states are what this file is about.
jest.mock("@/components/charts", () => {
  // Declared inside the factory: jest hoists this call above the file body.
  const drawn = (testId: string) => {
    const Chart = ({ series }: { series: { key: string }[] }) => (
      <div
        data-testid={testId}
        data-series={series.map((s) => s.key).join(",")}
      />
    );
    Chart.displayName = testId;
    return Chart;
  };
  return {
    TrendLineChart: drawn("line-chart"),
    CategoryBarChart: drawn("bar-chart"),
  };
});

let trends: {
  data?: { date: string; deposits: number; withdrawals: number; exchange: number }[];
  isLoading: boolean;
  isError: boolean;
};
jest.mock("@/lib/api/hooks", () => ({
  useTrends: () => ({ ...trends, refetch: jest.fn() }),
}));

const points = [
  { date: "2026-07-01", deposits: 120, withdrawals: 80, exchange: 10 },
  { date: "2026-07-02", deposits: 140, withdrawals: 60, exchange: 20 },
];

describe("TrendsCard", () => {
  beforeEach(() => {
    trends = { data: points, isLoading: false, isError: false };
  });

  it("draws every series on one chart", () => {
    renderWithProviders(<TrendsCard />);

    expect(screen.getByTestId("line-chart")).toHaveAttribute(
      "data-series",
      "deposits,withdrawals,exchange",
    );
  });

  it("switches the drawing between a line and bars", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TrendsCard />);

    const group = screen.getByRole("radiogroup", {
      name: message("dashboard.chartTypeLabel"),
    });
    await user.click(
      within(group).getByRole("radio", {
        name: message("dashboard.chartTypeBar"),
      }),
    );

    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("hides a series without refetching, and narrows the register link to the last one left", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TrendsCard />);

    const group = screen.getByRole("group", {
      name: message("dashboard.trendSeriesLabel"),
    });
    for (const key of ["trendWithdrawals", "trendExchange"]) {
      await user.click(
        within(group).getByRole("button", { name: message(`dashboard.${key}`) }),
      );
    }

    expect(screen.getByTestId("line-chart")).toHaveAttribute(
      "data-series",
      "deposits",
    );
    // One series on show, so the link opens exactly the records that were drawn.
    expect(
      screen.getByRole("link", { name: message("dashboard.viewAll") }),
    ).toHaveAttribute(
      "href",
      "/core/analytics/all-operations?type=deposit&dateFrom=2026-07-01&dateTo=2026-07-02",
    );
  });

  it("asks for a series rather than drawing empty axes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TrendsCard />);

    const group = screen.getByRole("group", {
      name: message("dashboard.trendSeriesLabel"),
    });
    for (const key of ["trendDeposits", "trendWithdrawals", "trendExchange"]) {
      await user.click(
        within(group).getByRole("button", { name: message(`dashboard.${key}`) }),
      );
    }

    expect(
      screen.getByText(message("dashboard.trendNoSeries")),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("changes the range for the whole section at once", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TrendsCard />);

    const group = screen.getByRole("radiogroup", {
      name: message("dashboard.rangeLabel"),
    });
    await user.click(within(group).getByRole("radio", { name: /7/ }));

    expect(
      screen.getByRole("heading", {
        name: message("dashboard.trendsRange", { days: "7" }),
      }),
    ).toBeInTheDocument();
  });
});

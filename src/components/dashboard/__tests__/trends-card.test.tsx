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

// The drawing surface needs a real layout to render; the cards' titles,
// descriptions, actions and states are what this file is about.
jest.mock("@/components/charts", () => ({
  TrendAreaChart: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`chart-${dataKey}`} />
  ),
}));

let trends: {
  data?: { date: string; deposits: number; withdrawals: number; exchange: number }[];
  isLoading: boolean;
  isError: boolean;
};
jest.mock("@/lib/api/hooks", () => ({
  useTrends: () => ({ ...trends, refetch: jest.fn() }),
}));

const points = [
  { date: "2026-07-01", deposits: 120, withdrawals: 80, exchange: 0 },
  { date: "2026-07-02", deposits: 140, withdrawals: 60, exchange: 0 },
];

describe("TrendsCard", () => {
  beforeEach(() => {
    trends = { data: points, isLoading: false, isError: false };
  });

  it("gives every series its own card, description and register link", () => {
    renderWithProviders(<TrendsCard />);

    const deposits = screen
      .getByRole("heading", { name: message("dashboard.trendDeposits") })
      .closest("div")!.parentElement!.parentElement!;
    expect(
      within(deposits).getByText(message("dashboard.trendDepositsDescription")),
    ).toBeInTheDocument();

    const link = within(deposits).getByRole("link", {
      name: message("dashboard.viewAll"),
    });
    // Narrowed to the same records the chart drew — type and the drawn window.
    expect(link).toHaveAttribute(
      "href",
      "/core/analytics/all-operations?type=deposit&dateFrom=2026-07-01&dateTo=2026-07-02",
    );
  });

  it("shows an empty state for a flat series while the others still draw", () => {
    renderWithProviders(<TrendsCard />);

    expect(screen.getByTestId("chart-deposits")).toBeInTheDocument();
    expect(screen.getByTestId("chart-withdrawals")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-exchange")).not.toBeInTheDocument();
    expect(
      screen.getByText(message("dashboard.trendEmpty")),
    ).toBeInTheDocument();
  });

  it("changes the range for every card at once", async () => {
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

import { screen } from "@testing-library/react";
import { DashboardKpiCards } from "@/components/dashboard/kpi-cards";
import { renderWithProviders, message } from "@/test/utils";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

const summary = {
  totalClients: 128,
  totalAccounts: 341,
  todayOperations: 17,
  pendingAuthorizedWithdrawals: 3,
  pendingExternalTransfers: 2,
};

jest.mock("@/lib/api/hooks", () => ({
  useDashboardSummary: () => ({ data: summary, isLoading: false }),
  useTrends: () => ({ data: undefined, isLoading: false }),
}));

let allowed = true;
jest.mock("@/lib/use-permission", () => ({
  usePermission: () => ({ ready: true, failed: false, can: () => allowed }),
}));

describe("DashboardKpiCards", () => {
  beforeEach(() => {
    allowed = true;
  });

  it("makes every figure a shortcut into the register behind it", () => {
    renderWithProviders(<DashboardKpiCards />);

    const clients = screen.getByRole("link", {
      name: new RegExp(message("dashboard.totalClients")),
    });
    expect(clients).toHaveAttribute("href", "/core/clients/list");

    const pending = screen.getByRole("link", {
      name: new RegExp(message("dashboard.pendingApprovals")),
    });
    // Lands on the queue already showing the operations waiting on a decision.
    expect(pending).toHaveAttribute(
      "href",
      "/core/authorized-withdrawal?status=reserve",
    );
  });

  it("narrows the operations register to today, so the count clicked is the count shown", () => {
    renderWithProviders(<DashboardKpiCards />);

    const today = screen.getByRole("link", {
      name: new RegExp(message("dashboard.todayOperations")),
    });
    const href = today.getAttribute("href") ?? "";
    expect(href).toMatch(/^\/core\/analytics\/all-operations\?/);
    const params = new URLSearchParams(href.split("?")[1]);
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    expect(params.get("dateFrom")).toMatch(iso);
    expect(params.get("dateFrom")).toBe(params.get("dateTo"));
  });

  it("still shows the figure without the permission to open the register", () => {
    allowed = false;
    renderWithProviders(<DashboardKpiCards />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    // The pending total is the sum of both queues — 3 + 2.
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});

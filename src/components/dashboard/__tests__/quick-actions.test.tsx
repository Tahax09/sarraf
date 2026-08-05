import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QuickActionsPanel,
  QuickActionsRail,
} from "@/components/dashboard/quick-actions";
import { renderWithProviders, message } from "@/test/utils";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

let allowed: string[] = [];
jest.mock("@/lib/use-permission", () => ({
  usePermission: () => ({
    ready: true,
    failed: false,
    can: (module: string) => allowed.includes(module),
  }),
}));

describe("quick actions", () => {
  beforeEach(() => {
    allowed = ["deposits", "withdrawal", "fundTransfer", "ceft"];
  });

  it("offers every create flow the operator is allowed to reach", () => {
    renderWithProviders(<QuickActionsRail />);

    expect(
      screen.getByRole("link", { name: new RegExp(message("dashboard.quickDeposit")) }),
    ).toHaveAttribute("href", "/core/deposit/register");
    expect(
      screen.getByRole("link", {
        name: new RegExp(message("dashboard.quickExchange")),
      }),
    ).toHaveAttribute("href", "/core/currency-exchange-transfer/register");
  });

  it("hides the actions a permission does not cover rather than landing on a 403", () => {
    allowed = ["deposits"];
    renderWithProviders(<QuickActionsRail />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders nothing for an operator who may not create anything", () => {
    allowed = [];
    const { container } = renderWithProviders(<QuickActionsRail />);

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the panel collapsed until it is asked for", async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuickActionsPanel />);

    const toggle = screen.getByRole("button", {
      name: new RegExp(message("dashboard.quickActions")),
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("link")).toHaveLength(0);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
});

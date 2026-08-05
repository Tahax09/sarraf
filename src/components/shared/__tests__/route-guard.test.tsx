import { screen } from "@testing-library/react";
import { RouteGuard } from "@/components/shared/route-guard";
import { renderWithProviders, message } from "@/test/utils";
import { navigation } from "@/test/mock-navigation";
import type { PermissionMap } from "@/lib/permissions";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

const useCurrentUser = jest.fn();
jest.mock("@/lib/api/hooks", () => ({
  useCurrentUser: () => useCurrentUser(),
}));

/** Shapes the query result the guard reads. */
function session(permissions: PermissionMap) {
  return { data: { permissions }, isPending: false, isError: false };
}

beforeEach(() => {
  navigation.reset("/");
  useCurrentUser.mockReset();
});

function renderAt(path: string) {
  navigation.reset(path);
  return renderWithProviders(
    <RouteGuard>
      <p>page body</p>
    </RouteGuard>,
  );
}

describe("RouteGuard", () => {
  it("renders the page when the role holds the permission", () => {
    useCurrentUser.mockReturnValue(session({ users: ["view"] }));
    renderAt("/core/users");
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("denies access when the module is missing from the permission map", () => {
    useCurrentUser.mockReturnValue(session({ clients: ["view"] }));
    renderAt("/core/users");

    expect(screen.queryByText("page body")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      message("errors.deniedTitle"),
    );
  });

  it("names the section that was refused", () => {
    useCurrentUser.mockReturnValue(session({ clients: ["view"] }));
    renderAt("/core/users");
    expect(
      screen.getByText(
        message("errors.deniedModule", { module: message("nav.users") }),
      ),
    ).toBeInTheDocument();
  });

  /**
   * The nav shows a module when the role can view it; the register page behind
   * it still needs `create`. This is the case navigation visibility alone gets
   * wrong.
   */
  it("requires create — not view — on a registration route", () => {
    useCurrentUser.mockReturnValue(session({ withdrawal: ["view"] }));
    renderAt("/core/withdrawal/register");
    expect(screen.queryByText("page body")).not.toBeInTheDocument();

    useCurrentUser.mockReturnValue(session({ withdrawal: ["view", "create"] }));
    renderAt("/core/withdrawal/register");
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("withholds the page while the session is still loading", () => {
    useCurrentUser.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderAt("/core/users");
    expect(screen.queryByText("page body")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      message("common.loading"),
    );
  });

  it("lets a route with no module requirement through", () => {
    useCurrentUser.mockReturnValue(session({}));
    renderAt("/profile");
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  /**
   * A failed identity request is an outage, not a denial. Showing "access
   * denied" there would send the operator to an administrator over a network
   * blip; the page's own error state is the honest signal.
   */
  it("does not turn an identity outage into a denial", () => {
    useCurrentUser.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    renderAt("/core/users");
    expect(screen.getByText("page body")).toBeInTheDocument();
  });
});

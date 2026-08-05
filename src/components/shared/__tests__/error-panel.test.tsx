import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorPanel } from "@/components/shared/error-panel";
import { renderWithProviders, message } from "@/test/utils";
import { navigation } from "@/test/mock-navigation";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

const reportError = jest.fn();
jest.mock("@/lib/report-error", () => ({
  ...jest.requireActual("@/lib/report-error"),
  reportError: (...args: unknown[]) => reportError(...args),
}));

beforeEach(() => {
  navigation.reset("/dashboard");
  reportError.mockClear();
});

function boom(digest?: string) {
  const error = Object.assign(new Error("render failed"), { digest });
  return error;
}

describe("ErrorPanel", () => {
  it("shows an announced explanation instead of a blank page", () => {
    renderWithProviders(
      <ErrorPanel error={boom("abc123")} retry={jest.fn()} boundary="app" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      message("errors.title"),
    );
    expect(screen.getByText(message("errors.body"))).toBeInTheDocument();
  });

  /** The operator reads this reference to support; it has to be on screen. */
  it("prints the digest as the support reference", () => {
    renderWithProviders(
      <ErrorPanel error={boom("abc123")} retry={jest.fn()} boundary="app" />,
    );
    expect(
      screen.getByText(message("errors.reference", { reference: "abc123" })),
    ).toBeInTheDocument();
  });

  it("still prints a reference when the error carries no digest", () => {
    renderWithProviders(
      <ErrorPanel error={boom()} retry={jest.fn()} boundary="app" />,
    );
    expect(
      screen.getByText(new RegExp(message("errors.reference", { reference: "" }).trim())),
    ).toBeInTheDocument();
  });

  it("retries the failed segment on request", async () => {
    const user = userEvent.setup();
    const retry = jest.fn();
    renderWithProviders(
      <ErrorPanel error={boom()} retry={retry} boundary="app" />,
    );
    await user.click(screen.getByRole("button", { name: message("errors.retry") }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("offers a way back to the dashboard", () => {
    renderWithProviders(
      <ErrorPanel error={boom()} retry={jest.fn()} boundary="app" />,
    );
    expect(
      screen.getByRole("link", { name: message("errors.goHome") }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("reports the failure once, tagged with its boundary", () => {
    renderWithProviders(
      <ErrorPanel error={boom("abc123")} retry={jest.fn()} boundary="app" />,
    );
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ boundary: "app", digest: "abc123" }),
    );
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/auth/login-form";
import { ApiError } from "@/lib/api/client";
import { renderWithProviders, message } from "@/test/utils";
import { navigation } from "@/test/mock-navigation";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);
jest.mock("next/navigation", () =>
  jest.requireActual("@/test/mock-navigation").nextNavigationMock(),
);

const apiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({
  ...jest.requireActual("@/lib/api/client"),
  usingFixtures: false,
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

// The mark reads the theme, which this file has nothing to say about.
jest.mock("@/components/shared/logo", () => ({ Logo: () => null }));

// No site key in the test environment, so the challenge is off — the same shape
// a deployment without Turnstile runs in.
jest.mock("@/components/auth/turnstile", () => ({
  isTurnstileEnabled: () => false,
  Turnstile: () => null,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    navigation.reset("/login");
  });

  async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
      screen.getByRole("textbox", { name: new RegExp(message("auth.username")) }),
      "operator",
    );
    await user.type(
      document.querySelector("input[type=password]") as HTMLInputElement,
      "secret",
    );
    await user.click(
      screen.getByRole("button", { name: message("auth.signInCta") }),
    );
  }

  it("signs in and lands on the page the operator was sent away from", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue(null);
    renderWithProviders(<LoginForm />);

    await fillCredentials(user);

    expect(apiFetch).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: { username: "operator", password: "secret" },
    });
    expect(navigation.calls.at(-1)).toBe("/dashboard");
  });

  it("asks for the verification code when the backend requires one", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValueOnce({ otpRequired: true, challengeId: "c1" });
    renderWithProviders(<LoginForm />);

    await fillCredentials(user);

    // The password is gone from the page — the operator is one step further on.
    expect(document.querySelector("input[type=password]")).toBeNull();
    expect(screen.getByText(message("auth.otpSent"))).toBeInTheDocument();

    apiFetch.mockResolvedValueOnce(undefined);
    await user.type(
      screen.getByRole("textbox", { name: new RegExp(message("auth.otpCode")) }),
      "123456",
    );
    await user.click(
      screen.getByRole("button", { name: message("auth.verifyCta") }),
    );

    expect(apiFetch).toHaveBeenLastCalledWith("/auth/login/otp", {
      method: "POST",
      body: { code: "123456", challengeId: "c1" },
    });
    expect(navigation.calls.at(-1)).toBe("/dashboard");
  });

  it("says the same thing for a wrong password as for an unknown account", async () => {
    const user = userEvent.setup();
    apiFetch.mockRejectedValue(new ApiError("nope", 401));
    renderWithProviders(<LoginForm />);

    await fillCredentials(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      message("auth.invalidCredentials"),
    );
    expect(navigation.calls).toHaveLength(0);
  });

  it("separates a rate limit from a bad password", async () => {
    const user = userEvent.setup();
    apiFetch.mockRejectedValue(new ApiError("slow down", 429));
    renderWithProviders(<LoginForm />);

    await fillCredentials(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      message("auth.tooManyAttempts"),
    );
  });

  it("reveals the password only while the toggle is on", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    const field = document.querySelector("input[type=password]");
    expect(field).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: message("auth.showPassword") }),
    );
    expect(document.querySelector("input[type=password]")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: message("auth.hidePassword") }),
    );
    expect(document.querySelector("input[type=password]")).not.toBeNull();
  });
});

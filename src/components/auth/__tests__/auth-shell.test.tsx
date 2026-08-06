import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthShell } from "@/components/auth/auth-shell";
import { renderWithProviders, message } from "@/test/utils";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);
jest.mock("next/navigation", () =>
  jest.requireActual("@/test/mock-navigation").nextNavigationMock(),
);

// The mark reads the theme, which is the thing under test here.
jest.mock("@/components/shared/logo", () => ({ Logo: () => null }));

/**
 * The signed-out pages have no header and no user menu, so the shell is the
 * only place these three controls can live. An operator who needs larger text
 * or more contrast needs them to read the sign-in form, not after it.
 */
describe("AuthShell", () => {
  function renderShell() {
    return renderWithProviders(
      <AuthShell title="Title" subtitle="Subtitle">
        <p>form</p>
      </AuthShell>,
      // As the real page tree is: the shortcut registry belongs to the app
      // shell, which these pages are outside of.
      { shortcuts: false },
    );
  }

  it("offers language, theme and accessibility before sign-in", () => {
    renderShell();

    expect(
      screen.getByRole("radiogroup", { name: message("user.language") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: message("common.themeDark") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: message("a11y.title") }),
    ).toBeInTheDocument();
  });

  it("switches the theme from the sign-in page", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole("button", { name: message("common.themeDark") }),
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    // The label names what pressing it does next, so it flips with the state.
    expect(
      screen.getByRole("button", { name: message("common.themeLight") }),
    ).toBeInTheDocument();
  });

  it("opens the accessibility centre without a shortcut registry above it", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole("button", { name: message("a11y.title") }),
    );

    expect(
      screen.getByRole("group", { name: message("a11y.textSize") }),
    ).toBeInTheDocument();
    // The shortcut sheet is the app shell's; a page that registers no chords
    // must not offer to list them.
    expect(
      screen.queryByRole("button", { name: message("a11y.keyboardAction") }),
    ).not.toBeInTheDocument();
  });
});

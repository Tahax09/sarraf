import { screen } from "@testing-library/react";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { renderWithProviders } from "@/test/utils";

describe("HeaderStatBar trend indicator", () => {
  it("names the comparison period next to the movement", () => {
    renderWithProviders(
      <HeaderStatBar
        stats={[
          {
            label: "Today's operations",
            value: "120",
            delta: { ratio: 0.2, label: "vs yesterday" },
          },
        ]}
      />,
    );

    expect(screen.getByText("+20%")).toBeInTheDocument();
    // An arrow with no period attached is not information.
    expect(screen.getByText("vs yesterday")).toBeInTheDocument();
  });

  it("colours by meaning, not by sign", () => {
    renderWithProviders(
      <HeaderStatBar
        stats={[
          {
            label: "Awaiting approval",
            value: "8",
            // A growing approval queue is bad news even though it is a rise.
            delta: { ratio: 0.5, label: "vs yesterday", goodWhenUp: false },
          },
        ]}
      />,
    );

    expect(screen.getByText("+50%").parentElement).toHaveClass("text-danger");
  });

  it("shows nothing extra when there is no comparison to draw", () => {
    renderWithProviders(
      <HeaderStatBar stats={[{ label: "Total clients", value: "40" }]} />,
    );

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

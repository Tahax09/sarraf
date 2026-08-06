import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { renderWithProviders } from "@/test/utils";

const SEGMENTS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

function Harness({ dir = "ltr" }: { dir?: "ltr" | "rtl" }) {
  const [value, setValue] = useState("a");
  return (
    <div dir={dir}>
      <SegmentedControl
        segments={SEGMENTS}
        value={value}
        onChange={setValue}
        ariaLabel="Letters"
      />
      <button type="button">after</button>
    </div>
  );
}

const options = () => screen.getAllByRole("radio");

describe("SegmentedControl", () => {
  it("is one tab stop, landing on the selected option", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.tab();
    expect(options()[0]).toHaveFocus();

    // The whole group is behind, not each option in turn.
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  it("moves and selects with the arrows", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(options()[1]).toHaveFocus();
    expect(options()[1]).toBeChecked();

    await user.keyboard("{ArrowLeft}");
    expect(options()[0]).toBeChecked();
  });

  it("wraps at both ends", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(options()[2]).toBeChecked();

    await user.keyboard("{ArrowRight}");
    expect(options()[0]).toBeChecked();
  });

  it("goes to the ends with Home and End", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.tab();
    await user.keyboard("{End}");
    expect(options()[2]).toBeChecked();

    await user.keyboard("{Home}");
    expect(options()[0]).toBeChecked();
  });

  it("follows the reading direction, so ArrowLeft advances in Arabic", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness dir="rtl" />);

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(options()[1]).toBeChecked();

    await user.keyboard("{ArrowRight}");
    expect(options()[0]).toBeChecked();
  });

  it("keeps the tab stop on whichever option is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(options()[2]!);
    expect(options()[2]).toHaveAttribute("tabindex", "0");
    expect(options()[0]).toHaveAttribute("tabindex", "-1");
  });
});

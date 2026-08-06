import { act, screen } from "@testing-library/react";
import { PrintLetterhead } from "@/components/layout/print-letterhead";
import { renderWithProviders } from "@/test/utils";

describe("PrintLetterhead", () => {
  it("carries the wordmark for the printed page", () => {
    renderWithProviders(<PrintLetterhead />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("stamps the time only once the print dialog opens", () => {
    renderWithProviders(<PrintLetterhead />);

    // Matched on the date rather than the sentence around it: the harness
    // renders the default locale, and the stamp is the part under test.
    const stamp = /\d{2}\/\d{2}\/\d{4}/;

    // Nothing on first render: a timestamp computed during render is a
    // hydration mismatch, and one computed on mount would say when the page was
    // opened rather than when the document was taken.
    expect(screen.queryByText(stamp)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });

    expect(screen.getByText(stamp)).toBeInTheDocument();
  });
});

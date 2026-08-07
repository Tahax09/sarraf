import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFeedback } from "@/components/providers/feedback-provider";
import { renderWithProviders, message } from "@/test/utils";

function Raise({ tone, reference }: { tone: "success" | "danger"; reference?: string }) {
  const { notify } = useFeedback();
  return (
    <button
      type="button"
      onClick={() => notify({ tone, message: "outcome", reference })}
    >
      raise
    </button>
  );
}

describe("FeedbackProvider", () => {
  it("announces a success politely and clears it on its own", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });
    renderWithProviders(<Raise tone="success" />);

    await user.click(screen.getByRole("button", { name: "raise" }));
    expect(screen.getByText("outcome")).toBeInTheDocument();
    // Polite, not assertive: nothing failed, so nothing interrupts.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.queryByText("outcome")).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it("keeps a failure and its reference until it is dismissed", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });
    renderWithProviders(<Raise tone="danger" reference="ref_9" />);

    await user.click(screen.getByRole("button", { name: "raise" }));
    expect(screen.getByRole("alert")).toHaveTextContent("outcome");
    expect(
      screen.getByText(message("feedback.reference", { reference: "ref_9" })),
    ).toBeInTheDocument();

    // The reference is what support asks for; it cannot expire out from under
    // the operator who is writing it down.
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: message("feedback.dismiss") }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it("refuses to be used outside the provider", () => {
    // A silent no-op would be worse than a crash: the caller would believe the
    // operator had been told something.
    const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Raise tone="success" />)).toThrow(/FeedbackProvider/);
    quiet.mockRestore();
  });
});

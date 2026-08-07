import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { renderWithProviders, message } from "@/test/utils";

const confirmWord = message("confirm.word");

describe("ConfirmDialog", () => {
  it("confirms a plain action in one click", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    renderWithProviders(
      <ConfirmDialog open onClose={() => {}} onConfirm={onConfirm} title="t" />,
    );

    await user.click(
      screen.getByRole("button", { name: message("common.confirm") }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("blocks a destructive action until the word is typed", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        requireTyped
        onClose={() => {}}
        onConfirm={onConfirm}
        title="t"
      />,
    );

    const button = screen.getByRole("button", {
      name: message("common.confirm"),
    });
    expect(button).toBeDisabled();

    await user.type(screen.getByRole("textbox"), confirmWord);
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("requires a reason when one is asked for, and passes it through", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="t"
        reason={{ label: "why", required: true }}
      />,
    );

    const button = screen.getByRole("button", {
      name: message("common.confirm"),
    });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/why/), "duplicate request");
    await user.click(button);

    expect(onConfirm).toHaveBeenCalledWith({ reason: "duplicate request" });
  });

  it("stays open and quotes a reference when the action fails", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onConfirm = jest.fn().mockRejectedValue(new Error("network"));

    renderWithProviders(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="t" />,
    );

    await user.click(
      screen.getByRole("button", { name: message("common.confirm") }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message("confirm.failed"));
    // The reference, not the backend's message: that can carry internals and is
    // not something an operator can act on.
    expect(alert).not.toHaveTextContent("network");
    expect(alert.textContent).toMatch(/[0-9a-f]{6}/);
    // A dialog that closed on failure would look exactly like one that
    // succeeded, which is the state most likely to be clicked through twice.
    expect(onClose).not.toHaveBeenCalled();
  });
});

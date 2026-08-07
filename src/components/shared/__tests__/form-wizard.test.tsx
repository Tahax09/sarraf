import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormWizard } from "@/components/shared/form-wizard";
import { renderWithProviders, message } from "@/test/utils";

const steps = [
  { id: "one", title: "one", content: <p>first</p> },
  { id: "two", title: "two", content: <p>second</p> },
];

describe("FormWizard", () => {
  it("shows the failure on the step the operator is looking at", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockRejectedValue(new Error("gateway"));

    renderWithProviders(<FormWizard steps={steps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: message("common.next") }));
    await user.click(
      screen.getByRole("button", { name: message("common.submit") }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message("common.submitFailed"));
    expect(alert).not.toHaveTextContent("gateway");
    // The form is still there to retry from — a register form that cleared
    // itself would cost the operator the whole transfer a second time.
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("blocks a step that does not validate", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    renderWithProviders(
      <FormWizard
        steps={[{ ...steps[0], validate: () => false }, steps[1]]}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: message("common.next") }));

    expect(screen.getByText("first")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaskedField, SecretField } from "@/components/shared/masked-field";
import { renderWithProviders, message } from "@/test/utils";

const IBAN = "LY83002048000020100120361";

const auditCalls: unknown[] = [];
jest.mock("@/lib/audit", () => ({
  useAuditLog: () => (payload: unknown) => {
    auditCalls.push(payload);
    return Promise.resolve();
  },
}));

beforeEach(() => {
  auditCalls.length = 0;
});

describe("MaskedField", () => {
  it("masks by default and never renders the full value", () => {
    renderWithProviders(
      <MaskedField value={IBAN} fieldName="iban" format="iban" />,
    );
    expect(screen.queryByText(new RegExp(IBAN))).not.toBeInTheDocument();
    expect(screen.getByText(/0361$/)).toBeInTheDocument();
  });

  it("reveals on demand and writes one audit event naming the field", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MaskedField
        value={IBAN}
        fieldName="iban"
        subjectType="externalTransfer"
        subjectId="op-1"
        format="iban"
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByText(/LY83 0020 4800/)).toBeInTheDocument();
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      event: "sensitive_field_revealed",
      field: "iban",
      subjectType: "externalTransfer",
      subjectId: "op-1",
    });
  });

  it("does not log again when hiding the value", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MaskedField value={IBAN} fieldName="iban" />);
    const toggle = screen.getByRole("button");
    await user.click(toggle);
    await user.click(toggle);
    expect(auditCalls).toHaveLength(1);
  });
});

describe("SecretField", () => {
  it("never re-displays a stored secret — only a Replace action", () => {
    renderWithProviders(
      <SecretField configured value="" onChange={() => {}} label="secret" />,
    );
    expect(
      screen.getByText(message("cbl.secretStored")),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: message("common.replace") }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("takes a new value only after Replace, as a password input", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <SecretField configured value="" onChange={onChange} label="secret" />,
    );

    await user.click(
      screen.getByRole("button", { name: message("common.replace") }),
    );

    const input = screen.getByLabelText("secret");
    expect(input).toHaveAttribute("type", "password");
    await user.type(input, "abc");
    expect(onChange).toHaveBeenCalled();
  });
});

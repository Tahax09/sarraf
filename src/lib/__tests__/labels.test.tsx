import { renderHook } from "@testing-library/react";
import { Providers, message } from "@/test/utils";
import { statusTone, useLabels } from "@/lib/labels";

function labels(locale: "ar" | "en" = "ar") {
  return renderHook(() => useLabels(), {
    wrapper: ({ children }) => <Providers locale={locale}>{children}</Providers>,
  }).result.current;
}

describe("enum label dictionary (§7 item 2)", () => {
  it("translates every ledger event the fixtures can produce", () => {
    const l = labels();
    expect(l.ledgerEvent("authorizedFundWithdrawalSettlement")).toBe(
      message("enums.ledgerEvent.authorizedFundWithdrawalSettlement"),
    );
    expect(l.ledgerEvent("roundingIncome")).toBe(
      message("enums.ledgerEvent.roundingIncome"),
    );
  });

  it("never leaks a raw code — unmapped values are marked, not printed bare", () => {
    const l = labels();
    const rendered = l.status("someBrandNewBackendCode");
    expect(rendered).not.toBe("someBrandNewBackendCode");
    expect(rendered).toContain("someBrandNewBackendCode");
  });

  it("renders a dash for null rather than 'null'", () => {
    expect(labels().operationType(null)).toBe("—");
  });

  it("translates in both languages", () => {
    expect(labels("en").operationType("deposit")).toBe(
      message("enums.operationType.deposit", "en"),
    );
    expect(labels("ar").operationType("deposit")).toBe(
      message("enums.operationType.deposit", "ar"),
    );
  });
});

describe("statusTone", () => {
  it("maps money-movement statuses to the right badge tones", () => {
    expect(statusTone("confirmed")).toBe("success");
    expect(statusTone("cancelled")).toBe("danger");
    expect(statusTone("expired")).toBe("warning");
    expect(statusTone("reserve")).toBe("info");
    expect(statusTone("whatever")).toBe("neutral");
  });
});

import {
  countryFlag,
  formatIban,
  formatPercentDelta,
  formatShare,
  formatPhone,
  isolate,
  isValidIban,
  isValidPhone,
  maskTail,
  normalizePhone,
} from "@/lib/format";

describe("phone formatting", () => {
  it("normalizes the shapes the backend actually returns", () => {
    // Canonical internal form is country code + national digits, no plus.
    expect(normalizePhone("0912345678")).toBe("218912345678");
    expect(normalizePhone("218912345678")).toBe("218912345678");
    expect(normalizePhone("+218 91 234 5678")).toBe("218912345678");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("renders one grouped form everywhere (§7 item 6)", () => {
    // Same number in three source shapes, one displayed result.
    const rendered = [
      formatPhone("0912345678"),
      formatPhone("218912345678"),
      formatPhone("+218912345678"),
    ];
    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toContain("+218");
  });

  it("falls back to a dash rather than printing an empty cell", () => {
    expect(formatPhone(null)).toBe("—");
  });

  it("validates length", () => {
    expect(isValidPhone("0912345678")).toBe(true);
    expect(isValidPhone("091234")).toBe(false);
  });
});

describe("IBAN", () => {
  it("accepts a valid IBAN regardless of spacing or case", () => {
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(isValidIban("gb82west12345698765432")).toBe(true);
    expect(isValidIban("LY83002048000020100120361")).toBe(true);
  });

  it("rejects a bad check digit, wrong length, and junk", () => {
    expect(isValidIban("GB82WEST12345698765431")).toBe(false);
    expect(isValidIban("GB82")).toBe(false);
    expect(isValidIban("not-an-iban")).toBe(false);
  });

  it("groups in fours for display", () => {
    expect(formatIban("GB82WEST12345698765432")).toBe(
      "GB82 WEST 1234 5698 7654 32",
    );
  });
});

describe("masking", () => {
  it("keeps only the trailing digits visible", () => {
    const masked = maskTail("GB82WEST12345698765432", 4);
    expect(masked.endsWith("5432")).toBe(true);
    expect(masked).not.toContain("WEST");
  });
});

describe("formatPercentDelta", () => {
  it("always writes the sign, so a movement cannot read as a share", () => {
    expect(formatPercentDelta(0.124)).toBe("+12.4%");
    expect(formatPercentDelta(-0.05)).toBe("−5%");
    expect(formatPercentDelta(0)).toBe("0%");
  });

  it("drops the decimal on whole percentages", () => {
    expect(formatPercentDelta(0.2)).toBe("+20%");
  });
});

describe("formatShare", () => {
  it("writes no sign, because a share is not a movement", () => {
    expect(formatShare(0.421)).toBe("42.1%");
    expect(formatShare(0.5)).toBe("50%");
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(1)).toBe("100%");
  });
});

describe("countryFlag", () => {
  it("maps alpha-2 codes to regional indicators", () => {
    expect(countryFlag("LY")).toBe("🇱🇾");
    expect(countryFlag("gb")).toBe("🇬🇧");
  });
});

describe("isolate", () => {
  it("wraps the value in FIRST STRONG ISOLATE … POP DIRECTIONAL ISOLATE", () => {
    const wrapped = isolate("1,234.560 LYD");
    expect(wrapped.codePointAt(0)).toBe(0x2068);
    expect(wrapped.codePointAt(wrapped.length - 1)).toBe(0x2069);
    // The value itself is untouched — this only adds directional context.
    expect(wrapped.slice(1, -1)).toBe("1,234.560 LYD");
  });

  it("accepts a number, so callers do not stringify first", () => {
    expect(isolate(42).slice(1, -1)).toBe("42");
  });
});

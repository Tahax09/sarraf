import {
  countryFlag,
  formatIban,
  formatPhone,
  isValidIban,
  isValidPhone,
  maskTail,
  normalizePhone,
  shortId,
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

  it("shortens raw ids for the detail drawer", () => {
    expect(shortId("9f8c1a2b3d4e5f6071829304", 6)).toContain("9f8c1a");
  });
});

describe("countryFlag", () => {
  it("maps alpha-2 codes to regional indicators", () => {
    expect(countryFlag("LY")).toBe("🇱🇾");
    expect(countryFlag("gb")).toBe("🇬🇧");
  });
});

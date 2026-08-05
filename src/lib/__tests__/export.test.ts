import { toCsv } from "@/lib/export";

describe("CSV export", () => {
  it("quotes and escapes embedded quotes and separators", () => {
    const csv = toCsv(["name", "note"], [['Ali "A"', "one,two"]]);
    expect(csv).toBe('"name","note"\r\n"Ali ""A""","one,two"');
  });

  it("neutralizes formula-leading cells (CSV injection)", () => {
    const csv = toCsv(["v"], [["=SUM(A1:A9)"], ["+1"], ["-1"], ["@x"]]);
    expect(csv).toContain(`"'=SUM(A1:A9)"`);
    expect(csv).toContain(`"'+1"`);
    expect(csv).toContain(`"'-1"`);
    expect(csv).toContain(`"'@x"`);
  });

  it("renders nulls as empty cells rather than the word null", () => {
    expect(toCsv(["a"], [[null]])).toBe('"a"\r\n""');
  });
});

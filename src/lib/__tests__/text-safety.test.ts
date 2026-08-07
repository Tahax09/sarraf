import {
  directionSafe,
  hasBidiControls,
  neutralizeBidi,
} from "@/lib/text-safety";
import { isolate } from "@/lib/format";

/**
 * The threat these cover: a stored value that reorders what is on screen, so
 * the operator approving a transfer reads a different string than the one the
 * backend holds and the audit trail records.
 */
const RLO = "\u202E";
const PDI = "\u2069";
const FSI = "\u2068";
const RLM = "\u200F";

describe("neutralizeBidi", () => {
  it("removes an explicit right-to-left override", () => {
    expect(neutralizeBidi(`Ahmed${RLO} LYD 5.000`)).toBe("Ahmed LYD 5.000");
  });

  it("removes every embedding, override and isolate", () => {
    const all = "\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069";
    expect(neutralizeBidi(`a${all}b`)).toBe("ab");
  });

  it("keeps directional marks, which cannot reorder a run", () => {
    // RLM appears in ordinary Arabic pasted from real documents. Stripping it
    // would corrupt legitimate names to prevent nothing.
    expect(neutralizeBidi(`\u0645\u062D\u0645\u062F${RLM}`)).toBe(
      `\u0645\u062D\u0645\u062F${RLM}`,
    );
  });

  it("leaves an ordinary bilingual name untouched", () => {
    expect(neutralizeBidi("\u0645\u062D\u0645\u062F Ali")).toBe(
      "\u0645\u062D\u0645\u062F Ali",
    );
  });
});

describe("isolate", () => {
  it("wraps the value in FSI and PDI", () => {
    expect(isolate("LYD")).toBe(`${FSI}LYD${PDI}`);
  });

  it("cannot be closed from inside", () => {
    // An unmatched PDI in the value would end the wrapper early and put the
    // remainder back into the surrounding sentence.
    const wrapped = isolate(`LYD${PDI} 5.000`);
    expect(wrapped).toBe(`${FSI}LYD 5.000${PDI}`);
    expect(wrapped.indexOf(PDI)).toBe(wrapped.length - 1);
  });

  it("accepts numbers", () => {
    expect(isolate(218)).toBe(`${FSI}218${PDI}`);
  });
});

describe("directionSafe", () => {
  it("rejects a name carrying an override", () => {
    expect(hasBidiControls(`Ahmed${RLO}`)).toBe(true);
    expect(directionSafe(`Ahmed${RLO}`)).toBe(false);
  });

  it("accepts ordinary text in either script", () => {
    expect(directionSafe("Ahmed Ali")).toBe(true);
    expect(directionSafe("\u0623\u062D\u0645\u062F \u0639\u0644\u064A")).toBe(true);
  });

  it("passes an absent optional field", () => {
    expect(directionSafe(undefined)).toBe(true);
    expect(directionSafe(null)).toBe(true);
  });

  it("is not stateful across calls", () => {
    // A `/g` regex reused with `test` alternates true/false. This must not.
    const value = `Ahmed${RLO}`;
    expect([directionSafe(value), directionSafe(value)]).toEqual([false, false]);
  });
});

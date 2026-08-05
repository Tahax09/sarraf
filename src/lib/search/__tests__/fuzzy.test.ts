import { fold, fuzzyMatch, highlight, matchFields } from "@/lib/search/fuzzy";

describe("fold", () => {
  it("unifies the alef variants an operator may type", () => {
    // The same name is spelled with any of these at the counter.
    expect(fold("أحمد")).toBe(fold("احمد"));
    expect(fold("إبراهيم")).toBe(fold("ابراهيم"));
    expect(fold("آمنة")).toBe(fold("امنه"));
  });

  it("drops Arabic diacritics and tatweel", () => {
    expect(fold("مُحَمَّد")).toBe(fold("محمد"));
    expect(fold("محـــمد")).toBe(fold("محمد"));
  });

  it("is case-insensitive for Latin text", () => {
    expect(fold("Tripoli Branch")).toBe(fold("tripoli branch"));
  });
});

describe("fuzzyMatch", () => {
  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyMatch("zzz", "Tripoli")).toBeNull();
  });

  it("ranks a prefix above a mid-word hit", () => {
    const prefix = fuzzyMatch("tri", "Tripoli")!;
    const middle = fuzzyMatch("pol", "Tripoli")!;
    expect(prefix.score).toBeGreaterThan(middle.score);
  });

  it("ranks a word start above an arbitrary position", () => {
    const wordStart = fuzzyMatch("bran", "Tripoli Branch")!;
    const inside = fuzzyMatch("ranc", "Tripoli Branch")!;
    expect(wordStart.score).toBeGreaterThan(inside.score);
  });

  it("matches scattered initials and reports their offsets", () => {
    const match = fuzzyMatch("tb", "Tripoli Branch")!;
    expect(match.matches).toEqual([0, 8]);
  });

  it("prefers a tight match over a scattered one of the same length", () => {
    const tight = fuzzyMatch("ab", "ab cdefgh")!;
    const scattered = fuzzyMatch("ab", "a cdefgh b")!;
    expect(tight.score).toBeGreaterThan(scattered.score);
  });

  it("finds an Arabic name typed without its diacritics", () => {
    expect(fuzzyMatch("محمد", "مُحَمَّد الطرابلسي")).not.toBeNull();
  });
});

describe("matchFields", () => {
  it("scores a non-title hit lower and returns no offsets for it", () => {
    // Offsets address the title only — highlighting a subtitle match on the
    // title would underline the wrong characters.
    const subtitleOnly = matchFields("0912", ["Ahmed Ali", "0912345678"])!;
    expect(subtitleOnly.matches).toEqual([]);

    const titleHit = matchFields("Ahmed", ["Ahmed Ali", "0912345678"])!;
    expect(titleHit.score).toBeGreaterThan(subtitleOnly.score);
  });

  it("returns null when no field matches", () => {
    expect(matchFields("zzz", ["Ahmed Ali", "0912345678"])).toBeNull();
  });

  it("ignores empty fields", () => {
    expect(matchFields("ahm", ["Ahmed", undefined, null])).not.toBeNull();
  });
});

describe("highlight", () => {
  it("splits into alternating matched and plain runs", () => {
    expect(highlight("Tripoli", [0, 1, 2])).toEqual([
      { text: "Tri", match: true },
      { text: "poli", match: false },
    ]);
  });

  it("handles matches that are not contiguous", () => {
    expect(highlight("abc", [0, 2])).toEqual([
      { text: "a", match: true },
      { text: "b", match: false },
      { text: "c", match: true },
    ]);
  });

  it("returns the whole string untouched when nothing matched", () => {
    expect(highlight("Tripoli", [])).toEqual([
      { text: "Tripoli", match: false },
    ]);
  });
});

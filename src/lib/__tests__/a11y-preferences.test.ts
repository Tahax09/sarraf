import {
  a11yCookieString,
  a11yDataAttributes,
  defaultA11yPreferences,
  parseA11yPreferences,
  serializeA11yPreferences,
} from "@/lib/a11y-preferences";

describe("a11y preferences", () => {
  it("round-trips through the cookie value", () => {
    const prefs = {
      motion: "reduced",
      contrast: "high",
      textSize: "larger",
    } as const;
    expect(parseA11yPreferences(serializeA11yPreferences(prefs))).toEqual(prefs);
  });

  it("falls back to the default for a missing cookie", () => {
    expect(parseA11yPreferences(undefined)).toEqual(defaultA11yPreferences);
  });

  it("ignores settings it does not recognise instead of throwing", () => {
    // Parsed during SSR — a hand-edited cookie must not take the page down.
    expect(parseA11yPreferences("motion:disco,contrast:high,text:")).toEqual({
      motion: "system",
      contrast: "high",
      textSize: "normal",
    });
  });

  it("survives a value that is not in the expected shape at all", () => {
    expect(parseA11yPreferences("garbage")).toEqual(defaultA11yPreferences);
  });

  it("produces the data attributes the stylesheet keys off", () => {
    expect(
      a11yDataAttributes({
        motion: "reduced",
        contrast: "normal",
        textSize: "large",
      }),
    ).toEqual({
      "data-motion": "reduced",
      "data-contrast": "normal",
      "data-text": "large",
    });
  });

  it("writes a scoped, non-session cookie", () => {
    const cookie = a11yCookieString(defaultA11yPreferences);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("samesite=lax");
    // Preferences are read by the client, so they are deliberately not httpOnly
    // — and they carry no identity or session material.
    expect(cookie).not.toContain("httponly");
  });
});

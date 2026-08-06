import { buildWorkbook, columnName, sheetTabName } from "@/lib/xlsx";
import type { WorkbookInput } from "@/lib/xlsx";

/**
 * Reads the archive back.
 *
 * Every part is written with the STORE method, so an entry's bytes are its
 * content verbatim and unzipping is a walk over the local headers. That is the
 * whole reason the tests below can assert on the workbook itself rather than on
 * a mocked download: what Excel would open is what is checked here.
 */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const parts = new Map<string, string>();

  let cursor = 0;
  while (cursor + 4 <= bytes.length && view.getUint32(cursor, true) === 0x04034b50) {
    const size = view.getUint32(cursor + 18, true);
    const nameLength = view.getUint16(cursor + 26, true);
    const extraLength = view.getUint16(cursor + 28, true);
    const nameStart = cursor + 30;
    const dataStart = nameStart + nameLength + extraLength;
    parts.set(
      decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)),
      decoder.decode(bytes.subarray(dataStart, dataStart + size)),
    );
    cursor = dataStart + size;
  }
  return parts;
}

const BASE: WorkbookInput = {
  sheetName: "Branches",
  title: "Daily report",
  meta: ["Saraf", "2026-08-05"],
  columns: [
    { header: "Branch", width: 24 },
    { header: "Operations", type: "number", format: "#,##0" },
    { header: "Net", type: "number" },
  ],
  rows: [
    ["Tripoli", 12, -450.5],
    ["Benghazi", 3, 900],
  ],
};

function sheet(input: WorkbookInput = BASE): string {
  return unzip(buildWorkbook(input)).get("xl/worksheets/sheet1.xml")!;
}

describe("buildWorkbook", () => {
  it("writes a readable archive with the parts Excel requires", () => {
    const parts = unzip(buildWorkbook(BASE));

    for (const required of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]) {
      expect(parts.has(required)).toBe(true);
    }

    // End-of-central-directory signature, so the archive is terminated rather
    // than merely starting with the right bytes.
    const bytes = buildWorkbook(BASE);
    const tail = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(tail.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  });

  it("is byte-identical across builds of the same report", () => {
    // The DOS timestamp is fixed for exactly this reason: a diff between two
    // exports is a difference in the data, never in when the button was pressed.
    expect(Array.from(buildWorkbook(BASE))).toEqual(Array.from(buildWorkbook(BASE)));
  });

  it("writes numbers as numbers and text as text", () => {
    const xml = sheet();

    // Numeric cells carry no `t` attribute and a bare `<v>`, which is what lets
    // Excel sum and sort them; the CSV this replaced made every amount a string.
    expect(xml).toContain("<v>12</v>");
    expect(xml).toContain("<v>-450.5</v>");
    // Text is inline, so there is no shared-strings table to keep in step.
    expect(xml).toContain('t="inlineStr"><is><t xml:space="preserve">Tripoli</t>');
  });

  it("keeps a non-finite number out of the numeric cell", () => {
    // `NaN` in a `<v>` is not a number Excel can parse — the file opens
    // "repaired", losing everything after the bad cell. It degrades to text.
    const xml = sheet({
      ...BASE,
      rows: [["Tripoli", Number.NaN, 1]],
    });
    expect(xml).not.toContain("<v>NaN</v>");
    expect(xml).toContain("NaN</t>");
  });

  /*
   * The security regression this replaces a CSV test with.
   *
   * `escapeCell` had to prefix `=`, `+`, `-` and `@` because a spreadsheet
   * parses a CSV field as a formula. A `.xlsx` cell does not: a formula lives in
   * an `<f>` element, and this writer emits none. The test asserts the property
   * rather than the old defence — a leading `=` survives verbatim as data, and
   * nothing in the workbook is executable.
   */
  it("cannot carry a formula, so a cell starting with = is inert", () => {
    const parts = unzip(
      buildWorkbook({ ...BASE, rows: [["=SUM(A1:A9)", 1, 2], ["@cmd|'/c calc'!A0", 1, 2]] }),
    );
    const xml = parts.get("xl/worksheets/sheet1.xml")!;

    expect(xml).toContain('<t xml:space="preserve">=SUM(A1:A9)</t>');
    for (const part of parts.values()) {
      expect(part).not.toContain("<f>");
    }
  });

  it("escapes markup rather than letting a value close a tag", () => {
    const xml = sheet({ ...BASE, rows: [['</t></is></c><f>1</f>', 1, 2]] });
    expect(xml).not.toContain("<f>1</f>");
    expect(xml).toContain("&lt;/t&gt;");
  });

  it("opens right-to-left only when asked", () => {
    expect(sheet({ ...BASE, rtl: true })).toContain('rightToLeft="1"');
    expect(sheet()).not.toContain("rightToLeft");
  });

  it("freezes the header row so it stays visible while scrolling", () => {
    expect(sheet()).toContain('<pane ySplit="');
    expect(sheet()).toContain('state="frozen"');
  });

  it("embeds a logo with the parts a drawing needs, and omits them otherwise", () => {
    const withLogo = unzip(
      buildWorkbook({
        ...BASE,
        logo: { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), width: 464, height: 128 },
      }),
    );
    expect(withLogo.has("xl/media/logo.png")).toBe(true);
    expect(withLogo.has("xl/drawings/drawing1.xml")).toBe(true);
    expect(withLogo.has("xl/drawings/_rels/drawing1.xml.rels")).toBe(true);
    expect(withLogo.has("xl/worksheets/_rels/sheet1.xml.rels")).toBe(true);
    expect(withLogo.get("xl/worksheets/sheet1.xml")).toContain("<drawing");

    // A workbook without one carries no dangling relationship: Excel repairs —
    // and silently rewrites — a sheet that references a part that is not there.
    const withoutLogo = unzip(buildWorkbook(BASE));
    expect(withoutLogo.has("xl/media/logo.png")).toBe(false);
    expect(withoutLogo.get("xl/worksheets/sheet1.xml")).not.toContain("<drawing");
  });

  it("keeps the decimals of a money column by default", () => {
    // `#,##0` would print a net flow of −450.5 as −451 — a figure that
    // disagrees with the screen it was taken from. The count column opts into
    // the whole-number format explicitly.
    const styles = unzip(buildWorkbook(BASE)).get("xl/styles.xml")!;
    expect(styles).toContain('formatCode="#,##0.###"');
    expect(styles).toContain('formatCode="#,##0"');
  });

  it("declares the default named style", () => {
    // Without it a strict reader applies its own default, which makes the
    // document's appearance depend on what opened it.
    expect(unzip(buildWorkbook(BASE)).get("xl/styles.xml")).toContain(
      '<cellStyle name="Normal"',
    );
  });

  it("applies the column widths it was given", () => {
    expect(sheet()).toContain('<col min="1" max="1" width="24"');
  });

  it("survives a report with no rows", () => {
    // The button is disabled at zero rows, but a filtered register can empty
    // between render and click, and a corrupt file is a worse answer than a
    // sheet with only its headings.
    const xml = sheet({ ...BASE, rows: [] });
    expect(xml).toContain("Branch");
    expect(xml).toContain("</worksheet>");
  });
});

describe("columnName", () => {
  it("counts in Excel's base-26", () => {
    expect(columnName(0)).toBe("A");
    expect(columnName(25)).toBe("Z");
    // The carry that catches every hand-rolled implementation: the alphabet has
    // no zero, so 26 is AA and not BA.
    expect(columnName(26)).toBe("AA");
    expect(columnName(701)).toBe("ZZ");
    expect(columnName(702)).toBe("AAA");
  });
});

describe("sheetTabName", () => {
  it("removes the characters Excel forbids in a tab name", () => {
    expect(sheetTabName("Q1/Q2: profit?")).not.toMatch(/[[\]:*?/\\]/);
  });

  it("truncates at Excel's 31-character limit", () => {
    expect(sheetTabName("x".repeat(60))).toHaveLength(31);
  });

  it("never returns an empty name", () => {
    // Excel rejects the file outright rather than ignoring the blank tab.
    expect(sheetTabName("///").length).toBeGreaterThan(0);
  });
});

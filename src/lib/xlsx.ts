/**
 * A spreadsheet writer, in about as little code as a real `.xlsx` can be
 * written in.
 *
 * The export used to be a CSV. CSV carries no types, so every amount arrived in
 * Excel as text and would not sum; no widths, so Arabic branch names arrived as
 * `####`; no direction, so an Arabic sheet opened left-to-right; and no place
 * to put the letterhead an operator is expected to hand to someone. A workbook
 * carries all four.
 *
 * There is no dependency behind this. An `.xlsx` is a ZIP of XML parts, and the
 * ZIP is written with the STORE method — no compression, which is a valid ZIP
 * and skips the only part that would have needed a library. A report of a few
 * thousand rows is a few hundred kilobytes; the file is written once, in a
 * click, and never served from a hot path.
 *
 * On injection: the CSV path has to neutralise cells beginning with `=`, `+`,
 * `-` or `@`, because a CSV cell is parsed as whatever it looks like. A
 * spreadsheet cell is not — a formula lives in an `<f>` element, and this
 * writer emits none, so a string that starts with `=` is written as, and stays,
 * a string. That is a property of the format rather than of an escape, which is
 * the better place for it to live.
 */

/* ---------------------------------------------------------------- types --- */

export type CellValue = string | number | null | undefined;

export type Column = {
  header: string;
  /** Width in characters, as Excel counts them. Defaults to 16. */
  width?: number;
  /**
   * Numbers are written as numbers so they sum, sort and chart. Anything left
   * as text is written as text — an account number is not a quantity, and Excel
   * eating its leading zero is a bug report waiting to happen.
   */
  type?: "text" | "number";
  /** Excel format code, e.g. `#,##0` or `#,##0.000`. Numbers only. */
  format?: string;
};

export type Logo = {
  bytes: Uint8Array;
  /** Natural pixel size; the image is drawn scaled to `height` px on the sheet. */
  width: number;
  height: number;
};

export type WorkbookInput = {
  /** Sheet tab name. Excel forbids `[]:*?/\` and stops at 31 characters. */
  sheetName: string;
  /** The heading printed above the table, in the sheet itself. */
  title: string;
  /** Lines under the title: the organisation, the filters, when it was taken. */
  meta?: string[];
  columns: Column[];
  rows: CellValue[][];
  /** Opens the sheet right-to-left, columns running from the right edge. */
  rtl?: boolean;
  logo?: Logo;
};

/* ------------------------------------------------------------------ zip --- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type Entry = { name: string; bytes: Uint8Array };

/**
 * A ZIP with one STORE-method entry per part.
 *
 * The DOS timestamp is fixed rather than taken from the clock: two exports of
 * the same report should produce the same bytes, which is what makes the tests
 * below able to assert on the archive instead of on a mock.
 */
function zip(entries: Entry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, 0, true); // time
    local.setUint16(12, 0x2821, true); // date: 2000-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    locals.push(new Uint8Array(local.buffer), name, entry.bytes);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, 0, true);
    central.setUint16(14, 0x2821, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);

    centrals.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + size;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

/* ------------------------------------------------------------------ xml --- */

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0 cannot represent the C0 controls at all — only tab, newline
    // and carriage return — so a stray one pasted into a name would make the
    // whole workbook unopenable rather than that one cell wrong.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** `0` → `A`, `26` → `AA`. */
export function columnName(index: number): string {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

const BRAND_DARK = "FF1C1E1C";
const BRAND_BORDER = "FFE3E5E3";
const META_GREY = "FF6B6F6B";

/** Style indexes into `cellXfs`, in the order they are written below. */
const STYLE = { title: 1, meta: 2, header: 3, text: 4 } as const;
/**
 * Thousands separators, and decimals only where a value has them.
 *
 * Not `#,##0`: this exports money, and a net flow of −49,650.25 displayed as
 * −49,650 is a figure that disagrees with the screen it was taken from. Not
 * `#,##0.000` either, which would print a count of 128 as 128.000. A column
 * that wants a fixed scale — a currency with three minor units — says so.
 */
const DEFAULT_NUMBER_FORMAT = "#,##0.###";

/** Number styles start here, one per distinct format code. */
const FIRST_NUMBER_STYLE = 5;

const EMU_PER_PX = 9525;

/* -------------------------------------------------------------- builder --- */

export function buildWorkbook(input: WorkbookInput): Uint8Array {
  const { columns, rows, logo } = input;
  const meta = input.meta ?? [];

  // One number format per distinct code, so the style table stays as small as
  // the sheet actually needs.
  const formats = [
    ...new Set(
      columns
        .filter((column) => column.type === "number")
        .map((column) => column.format ?? DEFAULT_NUMBER_FORMAT),
    ),
  ];
  const styleFor = (column: Column) =>
    column.type === "number"
      ? FIRST_NUMBER_STYLE + formats.indexOf(column.format ?? DEFAULT_NUMBER_FORMAT)
      : STYLE.text;

  /*
   * Rows above the table: the logo sits over row 1, then the title, then one
   * row per meta line, then a spacer. The header lands after all of it and the
   * pane is frozen there, so scrolling a long report keeps the column names.
   */
  const logoRows = logo ? 1 : 0;
  const headerRow = logoRows + 1 + meta.length + 1 + 1;
  const lastColumn = columnName(Math.max(columns.length - 1, 0));

  const encoder = new TextEncoder();
  const utf8 = (text: string) => encoder.encode(text);

  /* --- sheet ---------------------------------------------------------- */

  const sheetRows: string[] = [];

  if (logo) {
    // Tall enough for the artwork; the drawing is anchored, not in a cell.
    sheetRows.push(`<row r="1" ht="42" customHeight="1"/>`);
  }

  const titleRow = logoRows + 1;
  sheetRows.push(
    `<row r="${titleRow}" ht="22" customHeight="1"><c r="A${titleRow}" s="${STYLE.title}" t="inlineStr"><is><t xml:space="preserve">${esc(
      input.title,
    )}</t></is></c></row>`,
  );

  meta.forEach((line, index) => {
    const r = titleRow + 1 + index;
    sheetRows.push(
      `<row r="${r}"><c r="A${r}" s="${STYLE.meta}" t="inlineStr"><is><t xml:space="preserve">${esc(
        line,
      )}</t></is></c></row>`,
    );
  });

  sheetRows.push(
    `<row r="${headerRow}" ht="20" customHeight="1">${columns
      .map(
        (column, index) =>
          `<c r="${columnName(index)}${headerRow}" s="${
            STYLE.header
          }" t="inlineStr"><is><t xml:space="preserve">${esc(
            column.header,
          )}</t></is></c>`,
      )
      .join("")}</row>`,
  );

  rows.forEach((row, rowIndex) => {
    const r = headerRow + 1 + rowIndex;
    const cells = columns
      .map((column, index) => {
        const value = row[index];
        const ref = `${columnName(index)}${r}`;
        const style = styleFor(column);
        if (value === null || value === undefined || value === "") {
          return `<c r="${ref}" s="${style}"/>`;
        }
        if (column.type === "number") {
          const numeric = typeof value === "number" ? value : Number(value);
          // A column declared numeric that receives something unparseable is
          // written as the text it is, rather than as `NaN`, which Excel shows
          // as an error and which loses whatever the backend actually sent.
          if (Number.isFinite(numeric)) {
            return `<c r="${ref}" s="${style}"><v>${numeric}</v></c>`;
          }
          return `<c r="${ref}" s="${STYLE.text}" t="inlineStr"><is><t xml:space="preserve">${esc(
            String(value),
          )}</t></is></c>`;
        }
        return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(
          String(value),
        )}</t></is></c>`;
      })
      .join("");
    sheetRows.push(`<row r="${r}">${cells}</row>`);
  });

  const cols = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${
          column.width ?? 16
        }" customWidth="1"/>`,
    )
    .join("");

  const lastRow = headerRow + rows.length;
  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<dimension ref="A1:${lastColumn}${lastRow}"/>` +
    `<sheetViews><sheetView workbookViewId="0"${
      input.rtl ? ` rightToLeft="1"` : ""
    } showGridLines="0"><pane ySplit="${headerRow}" topLeftCell="A${
      headerRow + 1
    }" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${sheetRows.join("")}</sheetData>` +
    // The header row repeats on every printed page and the columns are made to
    // fit its width, because this file is printed at least as often as it is
    // opened.
    `<printOptions/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
    (logo
      ? `<drawing r:id="rId1"/>`
      : "") +
    `</worksheet>`;

  /* --- styles --------------------------------------------------------- */

  const numFmts = formats
    .map(
      (format, index) =>
        `<numFmt numFmtId="${164 + index}" formatCode="${esc(format)}"/>`,
    )
    .join("");

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    (numFmts ? `<numFmts count="${formats.length}">${numFmts}</numFmts>` : "") +
    `<fonts count="4">` +
    `<font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="16"/><color rgb="${BRAND_DARK}"/><name val="Calibri"/></font>` +
    `<font><sz val="9"/><color rgb="${META_GREY}"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="${BRAND_DARK}"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="2">` +
    `<border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left/><right/><top/><bottom style="thin"><color rgb="${BRAND_BORDER}"/></bottom><diagonal/></border>` +
    `</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${FIRST_NUMBER_STYLE + formats.length}">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>` +
    formats
      .map(
        (_, index) =>
          `<xf numFmtId="${
            164 + index
          }" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>`,
      )
      .join("") +
    `</cellXfs>` +
    // The "Normal" named style. Optional by the letter of the schema, but a
    // strict reader warns that the workbook has no default style and applies
    // its own — which is a document whose appearance depends on what opened it.
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  /* --- parts ---------------------------------------------------------- */

  const entries: Entry[] = [
    {
      name: "[Content_Types].xml",
      bytes: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          (logo ? `<Default Extension="png" ContentType="image/png"/>` : "") +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          (logo
            ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
            : "") +
          `</Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      bytes: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      bytes: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${esc(
            sheetTabName(input.sheetName),
          )}" sheetId="1" r:id="rId1"/></sheets>` +
          `</workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      bytes: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ),
    },
    { name: "xl/styles.xml", bytes: utf8(styles) },
    { name: "xl/worksheets/sheet1.xml", bytes: utf8(sheet) },
  ];

  if (logo) {
    // Scaled to a fixed 34px height so a wide lockup and a square mark both sit
    // on one row instead of the artwork deciding the page layout.
    const height = 34;
    const width = Math.round((logo.width / logo.height) * height);

    entries.push(
      {
        name: "xl/worksheets/_rels/sheet1.xml.rels",
        bytes: utf8(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>` +
            `</Relationships>`,
        ),
      },
      {
        name: "xl/drawings/drawing1.xml",
        bytes: utf8(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
            `<xdr:oneCellAnchor>` +
            `<xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from>` +
            `<xdr:ext cx="${width * EMU_PER_PX}" cy="${height * EMU_PER_PX}"/>` +
            `<xdr:pic>` +
            `<xdr:nvPicPr><xdr:cNvPr id="1" name="logo"/><xdr:cNvPicPr/></xdr:nvPicPr>` +
            `<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
            `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${
              width * EMU_PER_PX
            }" cy="${
              height * EMU_PER_PX
            }"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
            `</xdr:pic>` +
            `<xdr:clientData/>` +
            `</xdr:oneCellAnchor>` +
            `</xdr:wsDr>`,
        ),
      },
      {
        name: "xl/drawings/_rels/drawing1.xml.rels",
        bytes: utf8(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/>` +
            `</Relationships>`,
        ),
      },
      { name: "xl/media/logo.png", bytes: logo.bytes },
    );
  }

  return zip(entries);
}

/**
 * Excel rejects `[]:*?/\` in a tab name and truncates past 31 characters, and
 * it rejects the whole file rather than the name — so this is enforced here
 * instead of at every call site.
 */
export function sheetTabName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

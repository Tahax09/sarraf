"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isLocale, localeDirection } from "@/i18n/routing";
import { downloadWorkbook, loadLogo, printToPdf } from "@/lib/export";
import { sheetTabName, type CellValue } from "@/lib/xlsx";
import { formatDateTime } from "@/lib/format";

import lockupLtr from "@/logo/LogoLTR-N@4x.png";
import lockupRtl from "@/logo/LogoRTL-N@4x.png";

/**
 * One column of the export, as a header plus the value to read from a row.
 *
 * Accessors rather than the two parallel arrays this replaced: a header list
 * and a row-building `map` drift apart the moment someone inserts a column in
 * one and not the other, and the failure is a silently mislabelled spreadsheet
 * rather than a build error.
 */
export type ExportColumn<Row> = {
  header: string;
  value: (row: Row) => CellValue;
  /** Numbers are written as numbers so Excel can sum them. Default: text. */
  type?: "text" | "number";
  /** Excel format code for numeric columns, e.g. `#,##0.000`. */
  format?: string;
  /** Width in characters. Default: 16. */
  width?: number;
};

/**
 * The Export Excel / Export PDF pair, in one place.
 *
 * Both exports cover the rows currently held on the page. Where a register is
 * server-paged that is one page — a real limitation of exporting from the
 * client, not an oversight: a whole-ledger export needs a backend endpoint the
 * contract does not expose. Those call sites pass `excelLabel` so the button
 * says "export page" rather than promising the ledger.
 */
export function ExportActions<Row>({
  filename,
  title,
  sheetName,
  meta,
  columns,
  rows,
  excelLabel,
  print = true,
  className,
}: {
  /** Base name, without extension. A date or filter belongs in it. */
  filename: string;
  /** Heading printed at the top of the sheet. */
  title: string;
  /** Tab name; falls back to the title, sanitised and truncated by Excel's rules. */
  sheetName?: string;
  /** What the export is scoped to — the date, the branch, the applied filter. */
  meta?: string[];
  columns: ExportColumn<Row>[];
  rows: Row[];
  /**
   * Label for the spreadsheet button. Override it where the export covers less
   * than the register — a server-paged table exports the page, and the button
   * has to say so rather than promise the whole ledger.
   */
  excelLabel?: string;
  /**
   * Offer print-to-PDF. Off where the page is a working surface rather than a
   * document: printing a filter bar and two charts is not a report.
   */
  print?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const tApp = useTranslations("app");
  const locale = useLocale();
  const direction = isLocale(locale) ? localeDirection[locale] : "rtl";

  const [busy, setBusy] = useState(false);
  const empty = rows.length === 0;

  async function exportExcel() {
    setBusy(true);
    try {
      const lockup = direction === "rtl" ? lockupRtl : lockupLtr;
      downloadWorkbook(filename, {
        sheetName: sheetTabName(sheetName ?? title),
        title,
        meta: [
          tApp("name"),
          ...(meta ?? []),
          tApp("generatedAt", { datetime: formatDateTime(new Date()) }),
        ],
        rtl: direction === "rtl",
        logo: await loadLogo(lockup),
        columns: columns.map((column) => ({
          header: column.header,
          type: column.type,
          format: column.format,
          width: column.width,
        })),
        rows: rows.map((row) => columns.map((column) => column.value(row))),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    // Hidden on paper: the buttons that produced the printout have no business
    // being in it.
    <div className={className ?? "print:hidden flex gap-2"}>
      <Button
        variant="secondary"
        loading={busy}
        disabled={empty}
        onClick={exportExcel}
      >
        <FileDown className="size-4" aria-hidden />
        {excelLabel ?? t("exportExcel")}
      </Button>
      {print ? (
        <Button variant="secondary" disabled={empty} onClick={printToPdf}>
          <Printer className="size-4" aria-hidden />
          {t("exportPdf")}
        </Button>
      ) : null}
    </div>
  );
}

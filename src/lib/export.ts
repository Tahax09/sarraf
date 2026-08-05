/**
 * Client-side export helpers.
 *
 * The backend exposes no export endpoint in the contract we were given, so the
 * data already on screen is serialized in the browser. That keeps exports
 * consistent with what the user is looking at and avoids inventing an API.
 */

/** Cells starting with a formula character are neutralized (CSV injection). */
function escapeCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]) {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

/** Downloads a UTF-8 CSV (BOM included so Excel reads Arabic correctly). */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const blob = new Blob(["﻿", toCsv(headers, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * PDF export goes through the browser's own print-to-PDF. No third-party PDF
 * bundle ships to the client, and the print stylesheet controls the output.
 */
export function printToPdf() {
  window.print();
}

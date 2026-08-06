/**
 * Client-side export helpers.
 *
 * The backend exposes no export endpoint in the contract we were given, so the
 * data already on screen is serialized in the browser. That keeps exports
 * consistent with what the user is looking at and avoids inventing an API.
 *
 * The spreadsheet path is a real workbook rather than a CSV — see
 * `src/lib/xlsx.ts` for why, and for the note on why the formula-injection
 * neutralisation a CSV needs does not apply to a `.xlsx` cell.
 */

import { buildWorkbook, type Logo, type WorkbookInput } from "@/lib/xlsx";

/** Saves a blob under `filename` through a synthetic anchor. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Builds the workbook and hands it to the browser.
 *
 * The MIME type is the OOXML one, not `application/octet-stream`: macOS and
 * Windows both pick the opening application from it, and a download that lands
 * as "unknown file" is a support call.
 */
export function downloadWorkbook(filename: string, input: WorkbookInput) {
  const bytes = buildWorkbook(input);
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveBlob(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/**
 * Reads a bundled image into the bytes the workbook writer embeds.
 *
 * The lockups are static imports, so the URL is a hashed same-origin asset
 * under `/_next/static/media/` and the fetch is permitted by `connect-src
 * 'self'` without widening the policy for an export.
 *
 * Failure is not an error the operator should see. A missing letterhead is a
 * cosmetic loss; refusing to export the figures because of it is not. The
 * caller gets `undefined` and the workbook is written without a logo.
 */
export async function loadLogo(image: {
  src: string;
  width: number;
  height: number;
}): Promise<Logo | undefined> {
  try {
    const response = await fetch(image.src);
    if (!response.ok) return undefined;
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      width: image.width,
      height: image.height,
    };
  } catch {
    return undefined;
  }
}

/**
 * PDF export goes through the browser's own print-to-PDF. No third-party PDF
 * bundle ships to the client, and the print stylesheet controls the output.
 */
export function printToPdf() {
  window.print();
}

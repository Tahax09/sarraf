import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportActions } from "@/components/shared/export-actions";
import { renderWithProviders } from "@/test/utils";

type Row = { branch: string; operations: number };

const ROWS: Row[] = [
  { branch: "Tripoli", operations: 12 },
  { branch: "Benghazi", operations: 3 },
];

const COLUMNS = [
  { header: "Branch", value: (row: Row) => row.branch },
  { header: "Operations", value: (row: Row) => row.operations, type: "number" as const },
];

/** The saved file, captured instead of written. */
let saved: { name: string; blob: Blob } | null;

beforeEach(() => {
  saved = null;
  URL.createObjectURL = jest.fn(() => "blob:test");
  URL.revokeObjectURL = jest.fn();
  jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      saved = { name: this.download, blob: new Blob() };
    });
  // The lockup fetch: same-origin, and irrelevant to what these tests assert.
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(4),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
  // @ts-expect-error -- restoring jsdom's absence of fetch
  delete globalThis.fetch;
});

describe("ExportActions", () => {
  it("offers both exports and produces a workbook under the given name", async () => {
    renderWithProviders(
      <ExportActions
        filename="branch-report"
        title="Branch report"
        columns={COLUMNS}
        rows={ROWS}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /excel/i }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved!.name).toBe("branch-report.xlsx");
    expect(screen.getByRole("button", { name: /pdf/i })).toBeInTheDocument();
  });

  it("disables both buttons when there is nothing to export", () => {
    renderWithProviders(
      <ExportActions filename="empty" title="Empty" columns={COLUMNS} rows={[]} />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("omits the print button where the page is not a document", () => {
    renderWithProviders(
      <ExportActions
        filename="ledger"
        title="Ledger"
        print={false}
        columns={COLUMNS}
        rows={ROWS}
      />,
    );

    expect(screen.queryByRole("button", { name: /pdf/i })).not.toBeInTheDocument();
  });

  it("uses the label the caller gave the spreadsheet button", () => {
    // A server-paged register exports the page, and the button has to say so
    // rather than promise the whole ledger.
    renderWithProviders(
      <ExportActions
        filename="ledger"
        title="Ledger"
        excelLabel="Export page"
        columns={COLUMNS}
        rows={ROWS}
      />,
    );

    expect(screen.getByRole("button", { name: "Export page" })).toBeInTheDocument();
  });

  it("still exports when the logo cannot be fetched", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    renderWithProviders(
      <ExportActions
        filename="branch-report"
        title="Branch report"
        columns={COLUMNS}
        rows={ROWS}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /excel/i }));

    // The letterhead is decoration; the figures are the point.
    await waitFor(() => expect(saved).not.toBeNull());
  });
});

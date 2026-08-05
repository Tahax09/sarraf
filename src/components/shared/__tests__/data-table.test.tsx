import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { renderWithProviders, message } from "@/test/utils";

type Row = { id: string; name: string; amount: number; fee: number | null };

const rows: Row[] = [
  { id: "8f2c9d1e4a", name: "شركة النور", amount: 1200, fee: null },
  { id: "1b7e3c5a9f", name: "علي محمد", amount: 300, fee: null },
];

function columns(anyFee: boolean): Column<Row>[] {
  return [
    { key: "name", header: "الاسم", primary: true, cell: (row) => row.name },
    { key: "amount", header: "المبلغ", cell: (row) => row.amount },
    {
      key: "fee",
      header: "العمولة",
      hidden: !anyFee,
      cell: (row) => row.fee ?? 0,
    },
  ];
}

describe("DataTable", () => {
  it("drops the fee column entirely when no row carries a fee (§7 item 9)", () => {
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
      />,
    );
    expect(
      screen.queryByRole("columnheader", { name: "العمولة" }),
    ).not.toBeInTheDocument();
  });

  it("shows the fee column once a row actually has a fee", () => {
    renderWithProviders(
      <DataTable
        columns={columns(true)}
        rows={[{ ...rows[0], fee: 5 }]}
        getRowId={(row) => row.id}
        caption="t"
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "العمولة" }),
    ).toBeInTheDocument();
  });

  it("keeps raw backend ids out of the table and inside the drawer (§7 item 10)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        detailTitle={(row) => row.name}
        renderDetail={(row) => (
          <DetailSection title="d">
            <DetailRow label="id" value={row.id} numeric />
          </DetailSection>
        )}
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).queryByText("8f2c9d1e4a")).not.toBeInTheDocument();

    // The card fallback renders the same rows, so scope the click to the table.
    await user.click(within(table).getByText("شركة النور"));
    expect(await screen.findByText("8f2c9d1e4a")).toBeInTheDocument();
  });

  it("pages at 10 rows and keeps numbering running across pages", async () => {
    const user = userEvent.setup();
    const many: Row[] = Array.from({ length: 23 }, (_, index) => ({
      id: `row-${index}`,
      name: `عميل ${index + 1}`,
      amount: index,
      fee: null,
    }));
    renderWithProviders(
      <DataTable columns={columns(false)} rows={many} getRowId={(row) => row.id} caption="t" />,
    );

    const body = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(body()).toHaveLength(10);
    expect(within(body()[0]).getByText("1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: message("table.page", { page: "2" }) }),
    );

    const second = body();
    expect(second).toHaveLength(10);
    // Page 2 starts at 11 — the number is the row's place in the whole set.
    expect(within(second[0]).getByText("11")).toBeInTheDocument();
    expect(within(second[0]).getByText("عميل 11")).toBeInTheDocument();
  });

  it("honours a wider page size", async () => {
    const user = userEvent.setup();
    const many: Row[] = Array.from({ length: 23 }, (_, index) => ({
      id: `row-${index}`,
      name: `عميل ${index + 1}`,
      amount: index,
      fee: null,
    }));
    renderWithProviders(
      <DataTable columns={columns(false)} rows={many} getRowId={(row) => row.id} caption="t" />,
    );

    await user.selectOptions(
      screen.getByLabelText(message("table.rowsPerPage")),
      "25",
    );
    expect(within(screen.getByRole("table")).getAllByRole("row").slice(1)).toHaveLength(23);
  });

  it("leaves preview tables unpaged and unnumbered", () => {
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        paginate={false}
      />,
    );
    expect(
      screen.queryByRole("columnheader", { name: message("table.rowNumber") }),
    ).not.toBeInTheDocument();
  });

  it("renders an empty state instead of a bare table", () => {
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={[]}
        getRowId={(row) => row.id}
        caption="t"
      />,
    );
    expect(screen.getByText(message("common.empty"))).toBeInTheDocument();
  });

  it("offers a retry path on failure", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={[]}
        error
        onRetry={onRetry}
        getRowId={(row) => row.id}
        caption="t"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: message("common.retry") }),
    );
    expect(onRetry).toHaveBeenCalled();
  });
});

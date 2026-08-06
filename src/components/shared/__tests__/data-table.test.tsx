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

  it("renders drawer actions and closes the drawer when one of them asks", async () => {
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
        detailFooter={(row, close) => (
          <button type="button" onClick={close}>
            {`edit ${row.name}`}
          </button>
        )}
      />,
    );

    const table = screen.getByRole("table");
    await user.click(within(table).getByText("شركة النور"));

    // The action opening a dialog of its own has to be able to dismiss the
    // drawer first, or two modals fight over the focus trap.
    const action = await screen.findByRole("button", { name: "edit شركة النور" });
    await user.click(action);
    expect(screen.queryByText("8f2c9d1e4a")).not.toBeInTheDocument();
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

  it("reports the backend's total, not the size of the page it was given", () => {
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        pagination={{
          page: 1,
          pageSize: 2,
          total: 137,
          onPageChange: jest.fn(),
          onPageSizeChange: jest.fn(),
        }}
      />,
    );

    expect(
      screen.getAllByText(
        message("table.range", { from: "1", to: "2", total: "137" }),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders exactly the page the server returned, without re-slicing it", () => {
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        pagination={{
          page: 3,
          pageSize: 10,
          total: 137,
          onPageChange: jest.fn(),
          onPageSizeChange: jest.fn(),
        }}
      />,
    );

    const body = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(body).toHaveLength(2);
    // Numbering continues from the server's offset rather than restarting.
    expect(within(body[0]).getByText("21")).toBeInTheDocument();
  });

  it("hands paging back to the caller instead of paging in memory", async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    const onPageSizeChange = jest.fn();
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        pagination={{
          page: 1,
          pageSize: 10,
          total: 137,
          onPageChange,
          onPageSizeChange,
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: message("table.page", { page: "2" }) }),
    );
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.selectOptions(
      screen.getByLabelText(message("table.rowsPerPage")),
      "25",
    );
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it("announces the visible range to assistive technology", () => {
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        pagination={{
          page: 2,
          pageSize: 2,
          total: 9,
          onPageChange: jest.fn(),
          onPageSizeChange: jest.fn(),
        }}
      />,
    );

    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent(
      message("table.range", { from: "3", to: "4", total: "9" }),
    );
  });

  it("marks a sortable column and cycles it through the server's orderings", async () => {
    const user = userEvent.setup();
    const onSortChange = jest.fn();
    const sortable: Column<Row>[] = [
      { key: "name", header: "الاسم", primary: true, cell: (row) => row.name },
      {
        key: "amount",
        header: "المبلغ",
        sortKey: true,
        cell: (row) => row.amount,
      },
    ];

    const { rerender } = renderWithProviders(
      <DataTable
        columns={sortable}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        sort={null}
        onSortChange={onSortChange}
      />,
    );

    const header = () => screen.getByRole("columnheader", { name: /المبلغ/ });
    expect(header()).toHaveAttribute("aria-sort", "none");

    await user.click(within(header()).getByRole("button"));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "amount",
      direction: "asc",
    });

    rerender(
      <DataTable
        columns={sortable}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        sort={{ key: "amount", direction: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    expect(header()).toHaveAttribute("aria-sort", "ascending");

    await user.click(within(header()).getByRole("button"));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "amount",
      direction: "desc",
    });
  });

  it("leaves columns with no sort key inert", () => {
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={rows}
        getRowId={(row) => row.id}
        caption="t"
        sort={null}
        onSortChange={jest.fn()}
      />,
    );

    const header = screen.getByRole("columnheader", { name: "الاسم" });
    expect(header).not.toHaveAttribute("aria-sort");
    expect(within(header).queryByRole("button")).not.toBeInTheDocument();
  });

  it("switches row density and remembers the choice for the next register", async () => {
    const user = userEvent.setup();
    // Enough rows to page, which is where the density control lives.
    const many: Row[] = Array.from({ length: 12 }, (_, index) => ({
      id: `row-${index}`,
      name: `عميل ${index}`,
      amount: index,
      fee: null,
    }));
    const { unmount } = renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={many}
        getRowId={(row) => row.id}
        caption="t"
        paginate
      />,
    );

    await user.click(
      screen.getByRole("button", { name: message("table.densityCompact") }),
    );
    // The button now offers the way back, which is how it reports the state.
    expect(
      screen.getByRole("button", { name: message("table.densityComfortable") }),
    ).toBeInTheDocument();

    unmount();
    renderWithProviders(
      <DataTable
        columns={columns(false)}
        rows={many}
        getRowId={(row) => row.id}
        caption="t"
        paginate
      />,
    );
    expect(
      screen.getByRole("button", { name: message("table.densityComfortable") }),
    ).toBeInTheDocument();
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

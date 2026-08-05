import { act, renderHook } from "@testing-library/react";
import {
  DEFAULT_PAGE_SIZE,
  nextSort,
  useTableQuery,
} from "@/lib/use-table-query";

/**
 * The register state hook: what the backend is asked for, and when the reader
 * is put back on page 1 because the result set underneath them changed.
 */
describe("useTableQuery", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("asks for the first page with the caller's defaults", () => {
    const { result } = renderHook(() =>
      useTableQuery({ sort: { key: "createdAt", direction: "desc" } }),
    );

    expect(result.current.params).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: "createdAt:desc",
      q: undefined,
    });
  });

  it("holds the search term back until the reader stops typing", () => {
    const { result } = renderHook(() => useTableQuery());

    act(() => result.current.setSearch("ahm"));
    // Echoed to the input immediately, but not yet on the wire.
    expect(result.current.search).toBe("ahm");
    expect(result.current.params.q).toBeUndefined();

    act(() => jest.advanceTimersByTime(300));
    expect(result.current.params.q).toBe("ahm");
  });

  it("returns to page 1 when the search term changes", () => {
    const { result } = renderHook(() => useTableQuery());

    act(() => result.current.setPage(4));
    expect(result.current.params.page).toBe(4);

    act(() => result.current.setSearch("ahm"));
    act(() => jest.advanceTimersByTime(300));
    expect(result.current.params.page).toBe(1);
  });

  it("returns to page 1 when a filter changes", () => {
    const { result, rerender } = renderHook(
      ({ status }: { status: string }) => useTableQuery({ filters: { status } }),
      { initialProps: { status: "pending" } },
    );

    act(() => result.current.setPage(3));
    rerender({ status: "completed" });

    expect(result.current.params).toMatchObject({
      status: "completed",
      page: 1,
    });
  });

  it("returns to page 1 when the ordering or the page size changes", () => {
    const { result } = renderHook(() => useTableQuery());

    act(() => result.current.setPage(5));
    act(() => result.current.setSort({ key: "amount", direction: "asc" }));
    expect(result.current.params).toMatchObject({
      page: 1,
      sort: "amount:asc",
    });

    act(() => result.current.setPage(5));
    act(() => result.current.setPageSize(50));
    expect(result.current.params).toMatchObject({ page: 1, pageSize: 50 });
  });

  it("omits the search parameter on a register with nothing to search", () => {
    const { result } = renderHook(() => useTableQuery({ searchable: false }));

    expect("q" in result.current.params).toBe(false);
  });
});

describe("nextSort", () => {
  it("cycles a column ascending, descending, then back to server order", () => {
    const first = nextSort(null, "amount");
    expect(first).toEqual({ key: "amount", direction: "asc" });

    const second = nextSort(first, "amount");
    expect(second).toEqual({ key: "amount", direction: "desc" });

    expect(nextSort(second, "amount")).toBeNull();
  });

  it("starts a different column ascending", () => {
    expect(nextSort({ key: "amount", direction: "desc" }, "createdAt")).toEqual({
      key: "createdAt",
      direction: "asc",
    });
  });
});

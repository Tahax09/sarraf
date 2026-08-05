import { fixtureFetch } from "@/lib/api/fixtures";
import type { Paged } from "@/lib/api/types";

/**
 * The ledger is the largest fixture set by an order of magnitude, and the one
 * register that renders every row it is handed. When this endpoint answered a
 * paged request with the whole set, the page grew to a few thousand rows and
 * pushed its own filters and pager out of reach — so the contract it has to keep
 * is asserted here rather than left to be noticed on screen.
 */
describe("fixture ledger paging", () => {
  it("answers a paged request with one page and the full count", async () => {
    const page = await fixtureFetch<Paged<{ id: string }>>(
      "/analytics/all-operations",
      { method: "GET", params: { page: 1, pageSize: 10 } },
    );

    expect(page.items).toHaveLength(10);
    expect(page.pageSize).toBe(10);
    // `total` is every matching record, which is what the pager counts with.
    expect(page.total).toBeGreaterThan(page.items.length);
  });

  it("moves to the next page instead of repeating the first", async () => {
    const first = await fixtureFetch<Paged<{ id: string }>>(
      "/analytics/all-operations",
      { method: "GET", params: { page: 1, pageSize: 10 } },
    );
    const second = await fixtureFetch<Paged<{ id: string }>>(
      "/analytics/all-operations",
      { method: "GET", params: { page: 2, pageSize: 10 } },
    );

    expect(second.items).toHaveLength(10);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(second.total).toBe(first.total);
  });
});

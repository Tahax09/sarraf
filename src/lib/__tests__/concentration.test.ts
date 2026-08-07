import { concentration, type RankedHolder } from "@/lib/concentration";

const holder = (over: Partial<RankedHolder> = {}): RankedHolder => ({
  id: "cli_1",
  name: "عميل",
  nameEn: "Client",
  balance: 100,
  currency: "LYD",
  ...over,
});

describe("concentration", () => {
  it("measures the ranked clients against the whole book, not against each other", () => {
    const rows = concentration(
      [holder({ id: "a", balance: 300 }), holder({ id: "b", balance: 100 })],
      [{ currency: "LYD", total: 1000, accounts: 40 }],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].listed).toBe(400);
    expect(rows[0].share).toBeCloseTo(0.4);
    // Not 300/400: the largest holder's share is of the book as well.
    expect(rows[0].largestShare).toBeCloseTo(0.3);
    expect(rows[0].largestBalance).toBe(300);
    expect(rows[0].clients).toBe(2);
  });

  it("drops a currency the balances endpoint does not cover", () => {
    const rows = concentration(
      [holder({ currency: "USD" })],
      [{ currency: "LYD", total: 1000, accounts: 3 }],
    );

    // A share needs an honest denominator; a share of the rows on screen would
    // be a number about the screen.
    expect(rows).toEqual([]);
  });

  it("ignores holders with nothing on deposit", () => {
    const rows = concentration(
      [
        holder({ id: "a", balance: 250 }),
        holder({ id: "b", balance: 0 }),
        holder({ id: "c", balance: -50 }),
      ],
      [{ currency: "LYD", total: 500, accounts: 9 }],
    );

    expect(rows[0].clients).toBe(1);
    expect(rows[0].share).toBeCloseTo(0.5);
  });

  it("reads the most concentrated currency first", () => {
    const rows = concentration(
      [
        holder({ id: "a", currency: "LYD", balance: 100 }),
        holder({ id: "b", currency: "USD", balance: 900 }),
      ],
      [
        { currency: "LYD", total: 1000, accounts: 20 },
        { currency: "USD", total: 1000, accounts: 5 },
      ],
    );

    expect(rows.map((row) => row.currency)).toEqual(["USD", "LYD"]);
  });

  it("has no opinion when nothing is ranked", () => {
    expect(concentration([], [{ currency: "LYD", total: 10, accounts: 1 }]))
      .toEqual([]);
  });
});

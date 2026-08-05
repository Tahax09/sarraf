import { dayOverDayDelta } from "@/components/dashboard/kpi-bar";
import type { TrendPoint } from "@/lib/api/types";

function point(
  date: string,
  deposits: number,
  withdrawals = 0,
  exchange = 0,
): TrendPoint {
  return { date, deposits, withdrawals, exchange };
}

describe("dayOverDayDelta", () => {
  it("compares the totals of the last two days", () => {
    const delta = dayOverDayDelta([
      point("2026-08-01", 5, 3, 2), // 10
      point("2026-08-02", 6, 4, 2), // 12
    ]);
    expect(delta).toBeCloseTo(0.2);
  });

  it("reports a fall as a negative ratio", () => {
    expect(dayOverDayDelta([point("2026-08-01", 10), point("2026-08-02", 5)]))
      .toBeCloseTo(-0.5);
  });

  it("ignores every day but the last two", () => {
    const delta = dayOverDayDelta([
      point("2026-07-30", 900),
      point("2026-08-01", 10),
      point("2026-08-02", 10),
    ]);
    expect(delta).toBe(0);
  });

  // The indicator is suppressed rather than invented — see the note on the
  // function. A percentage against nothing is a division by zero in disguise.
  it("returns null when there is nothing to compare against", () => {
    expect(dayOverDayDelta(undefined)).toBeNull();
    expect(dayOverDayDelta([])).toBeNull();
    expect(dayOverDayDelta([point("2026-08-02", 12)])).toBeNull();
    expect(
      dayOverDayDelta([point("2026-08-01", 0), point("2026-08-02", 12)]),
    ).toBeNull();
  });
});

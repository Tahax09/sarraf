import { routeName } from "@/components/providers/telemetry-provider";

/**
 * Cardinality is the whole game here. A metric keyed on the raw path produces
 * one series per client and answers nothing; worse, it puts record ids into
 * whatever store the sink forwards to.
 */
describe("routeName", () => {
  it("drops the locale prefix", () => {
    expect(routeName("/ar/dashboard")).toBe("/dashboard");
    expect(routeName("/en/dashboard")).toBe("/dashboard");
  });

  it("collapses record identifiers", () => {
    expect(routeName("/ar/core/clients/cli_1000")).toBe("/core/clients/[id]");
    expect(routeName("/en/core/accounts/acc_0_0")).toBe("/core/accounts/[id]");
  });

  it("leaves ordinary segments alone", () => {
    expect(routeName("/ar/core/analytics/branch-cash-flow")).toBe(
      "/core/analytics/branch-cash-flow",
    );
  });

  it("handles the root", () => {
    expect(routeName("/ar")).toBe("/");
  });
});

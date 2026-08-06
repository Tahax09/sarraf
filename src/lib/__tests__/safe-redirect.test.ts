import { safeRedirect } from "../safe-redirect";

/**
 * The interesting cases are all hostile. A regression here is an open redirect
 * on the sign-in page, so each rejected shape is named rather than folded into
 * a table: when one of these starts passing, the failure should say which.
 */
describe("safeRedirect", () => {
  it("keeps an in-app path", () => {
    expect(safeRedirect("/core/accounts")).toBe("/core/accounts");
    expect(safeRedirect("/core/clients/list?tab=all")).toBe(
      "/core/clients/list?tab=all",
    );
  });

  it("falls back when there is nothing to go to", () => {
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect("")).toBe("/dashboard");
  });

  it("refuses an absolute URL", () => {
    expect(safeRedirect("https://evil.test/login")).toBe("/dashboard");
    expect(safeRedirect("http://evil.test")).toBe("/dashboard");
  });

  it("refuses a protocol-relative URL", () => {
    expect(safeRedirect("//evil.test/login")).toBe("/dashboard");
  });

  it("refuses a backslash authority, which browsers normalise to a slash", () => {
    expect(safeRedirect("/\\evil.test")).toBe("/dashboard");
  });

  it("refuses a scheme with no leading slash", () => {
    expect(safeRedirect("javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirect("data:text/html,<script>alert(1)</script>")).toBe(
      "/dashboard",
    );
  });

  it("refuses C0 characters, which are stripped before the URL is resolved", () => {
    expect(safeRedirect("/\t/evil.test")).toBe("/dashboard");
    expect(safeRedirect("/\n/evil.test")).toBe("/dashboard");
    expect(safeRedirect("/\r/evil.test")).toBe("/dashboard");
    expect(safeRedirect("/ /evil.test")).toBe("/dashboard");
  });

  it("honours a caller's fallback", () => {
    expect(safeRedirect("https://evil.test", "/login")).toBe("/login");
  });
});

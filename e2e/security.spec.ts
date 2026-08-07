import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

/**
 * The headers, asserted against a served response rather than against the file
 * that is supposed to produce them.
 *
 * `next.config.ts` and `src/proxy.ts` both claim to set security headers. A
 * claim in a config file is worth nothing on its own: a header can be dropped
 * by a rewrite, overwritten by the intl middleware, or set on a response that
 * is never the one the browser gets. This spec reads what actually arrives.
 *
 * The interesting assertions are negative — the absence of `unsafe-inline` in
 * `script-src`, the absence of `unsafe-eval` in a production build — and a
 * negative assertion is only meaningful against the artefact that ships. A
 * development server relaxes `script-src` on purpose, so the CSP block is
 * skipped unless `E2E_PROD=1`, exactly like the JavaScript budget.
 */

const IS_PROD = process.env.E2E_PROD === "1";

/** Reads the response headers for a navigation, not for a subresource. */
async function headersFor(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response, `no response for ${path}`).not.toBeNull();
  return response!.headers();
}

test.describe("security headers", () => {
  test("the sign-in page carries the static hardening headers", async ({
    page,
  }) => {
    const headers = await headersFor(page, "/ar/login");

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    // Two years, subdomains included. `preload` is deliberately absent — see
    // docs/SECURITY.md.
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["strict-transport-security"]).not.toContain("preload");
    // A back office never needs a camera, and says so before a dependency asks.
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("a signed-in route carries them too", async ({ page }) => {
    await login(page);
    const headers = await headersFor(page, "/ar/dashboard");

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
  });

  test("the policy is per-request, and the nonce is not reused", async ({
    page,
  }) => {
    const first = (await headersFor(page, "/ar/login"))[
      "content-security-policy"
    ];
    const second = (await headersFor(page, "/ar/forgot-password"))[
      "content-security-policy"
    ];

    const nonce = (csp: string | undefined) =>
      csp?.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce(first)).toBeTruthy();
    expect(nonce(second)).toBeTruthy();
    // A nonce that repeats is a nonce an injected script can be written to
    // carry, which is the whole mechanism gone.
    expect(nonce(first)).not.toBe(nonce(second));
  });

  test("the policy closes the directives it claims to", async ({ page }) => {
    const csp = (await headersFor(page, "/ar/login"))[
      "content-security-policy"
    ];
    expect(csp).toBeTruthy();

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("'strict-dynamic'");
  });

  test("a production policy allows neither inline script nor eval", async ({
    page,
  }) => {
    test.skip(
      !IS_PROD,
      "next dev relaxes script-src on purpose; run against a build",
    );

    const csp = (await headersFor(page, "/ar/login"))[
      "content-security-policy"
    ]!;
    const scriptSrc = csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("script-src"))!;

    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });
});

test.describe("open redirect", () => {
  /**
   * `?from=` is attacker-controlled input on the one screen where the operator
   * is about to type a password. `safe-redirect.test.ts` covers the function;
   * this covers the wiring, which is the part a refactor breaks.
   */
  for (const hostile of [
    "https://evil.test/login",
    "//evil.test/login",
    "/\\evil.test",
  ]) {
    test(`sign-in ignores from=${hostile}`, async ({ page }) => {
      await login(page, { from: hostile });
      // The fallback, not the value that was asked for.
      await expect(page).toHaveURL(/\/dashboard$/);
      expect(page.url()).not.toContain("evil.test");
    });
  }

  test("a local path is honoured", async ({ page }) => {
    await login(page, { from: "/core/clients/list" });
    await expect(page).toHaveURL(/\/core\/clients\/list/);
  });
});

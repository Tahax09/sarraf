/**
 * Where a post-sign-in redirect is allowed to go.
 *
 * The proxy puts the path the operator was trying to reach in `?from=`, and the
 * sign-in form sends them there once they are in. That query string is not the
 * proxy's alone — anyone can write it — so `from` is attacker-controlled input
 * on the one screen where the operator has just been asked to type a password.
 *
 * `/login?from=https://saraf-payments.example/login` renders the real sign-in
 * page, and a successful sign-in lands on an attacker's copy of it asking to
 * "confirm" the credentials. The redirect is what makes that work, so the
 * redirect is what refuses.
 *
 * Only a path is accepted, and only one that cannot be read as an authority:
 *
 * - `https://evil.test` — carries a scheme
 * - `//evil.test/x` — protocol-relative, resolves to another host
 * - `/\evil.test` — browsers normalise the backslash to a slash
 * - `javascript:alert(1)` — no leading slash, so it fails the first test
 * - `/\t/evil.test` — C0 characters are stripped before the URL is
 *   resolved, which turns this into the second case after the fact
 */
export function safeRedirect(
  from: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!from || !from.startsWith("/")) return fallback;
  if (from.startsWith("//") || from.startsWith("/\\")) return fallback;
  if (/[\u0000-\u0020]/.test(from)) return fallback;
  return from;
}

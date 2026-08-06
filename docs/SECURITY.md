# Security

What this front end does, what it deliberately does not do, and what it cannot
do without the backend or the deployment.

This document does not claim compliance with any standard. It describes
implemented controls, aligned with OWASP ASVS where that is useful as a
checklist, and it names the gaps rather than rounding them off.

## The boundary

The backend is the security boundary. Everything here — route guards,
permission checks, disabled buttons, masked fields — is user-interface
behaviour. It stops an operator from doing something by accident and it stops a
casual attempt, and none of it survives a determined caller with a session and
`curl`. Every check in this panel must exist again on the server.

That is not a caveat added at the end. It is the reason the frontend's own
controls are the ones listed below and not others: they are the ones that are
worth something even when the attacker controls the client.

## Session and authentication

Recorded in full in [ADR-0001](adr/0001-the-session-is-a-cookie-the-panel-cannot-read.md).

| Control | Where |
| --- | --- |
| Session is an httpOnly cookie issued by the backend | `src/lib/api/client.ts` |
| No token, key, or credential in `localStorage` or `sessionStorage` | verified by `src/lib/__tests__/` and by inspection — nothing in `src/` writes a credential to storage |
| CSRF double-submit: `XSRF-TOKEN` cookie echoed in `X-XSRF-TOKEN` | `csrfHeader()` in `client.ts` |
| Unauthenticated routes redirect before rendering | `src/proxy.ts` |
| Post-sign-in redirect target validated | `src/lib/safe-redirect.ts` |
| Sign-in can require a Cloudflare Turnstile token | `src/components/auth/turnstile.tsx` |

`safeRedirect` is worth reading in full: `?from=` is attacker-controlled input
on the one screen where the operator is about to type a password, and a redirect
to a look-alike sign-in page is the entire attack. It accepts a bare local path
and refuses a scheme, a protocol-relative `//host`, a `/\host` (browsers
normalise the backslash), and anything containing a C0 control character
(stripped during URL resolution, which turns `/\t/evil.test` into the
protocol-relative case after the fact).

The Turnstile **site** key is public by design and comes from
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`; the secret half is the backend's and never
reaches this bundle. With no site key configured the widget does not render and
no token is sent, which is correct for a backend that does not verify one.

## Authorization

`src/lib/permissions.ts` resolves a module/action matrix for the signed-in
operator. `usePermission()` hides or disables actions, `<RouteGuard>` refuses a
page and renders `<AccessDenied>` rather than a blank, and `src/lib/nav.ts`
filters the sidebar from the same source — so a link an operator cannot use is
not shown, and typing its URL still refuses.

Direct navigation to a route the operator lacks was tested by hand: the guard
renders the denial, and every mutating hook still calls an endpoint that must
check again. Manipulating client state — flipping a permission in React
DevTools — reveals the UI, which is expected and is exactly why the server
check is not optional.

## Browser hardening

Static headers in `next.config.ts`, applied to every path:

| Header | Value | Why |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | no MIME guessing on an export download |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | two years, subdomains included |
| `X-Frame-Options` | `DENY` | with `frame-ancestors`, belt and braces |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | no path leaves the origin |
| `Permissions-Policy` | every powerful feature `()` except `fullscreen=(self)` | a back office never needs a camera, and should say so before a dependency asks |
| `Cross-Origin-Opener-Policy` | `same-origin` | severs `window.opener` both ways |
| `Cross-Origin-Embedder-Policy` / `Cross-Origin-Resource-Policy` | see the file | nothing here is embeddable by another origin |

`preload` is deliberately absent from HSTS. Submitting to the preload list is a
deployment decision that is painful to reverse and belongs to whoever owns the
domain, not to this repository.

**CSP is per-request, in `src/proxy.ts`,** with a fresh nonce and
`'strict-dynamic'`. An injected `<script>` carries no nonce and no loader will
pull it in. Two narrow relaxations, both deliberate:

- `style-src-attr 'unsafe-inline'` — chart heights and legend swatches are
  written as `style` attributes that a nonce cannot cover. Splitting the
  directive keeps `<style>` element injection blocked instead of relaxing all
  styles at once.
- `'unsafe-eval'` in development only, for the dev toolchain. Verified absent
  from a production build.

`connect-src` is derived from `NEXT_PUBLIC_API_BASE_URL`, so the policy cannot
drift away from the origin the app actually calls; a missing or malformed value
contributes nothing and leaves `connect-src 'self'`.

## Injection and output

- **XSS.** No `dangerouslySetInnerHTML` anywhere in `src/`, verified. All output
  goes through React's escaping. The one place raw text becomes markup is the
  print pipeline, which writes to a document built from `textContent`.
- **CSV formula injection.** Cells starting `=`, `+`, `-`, `@`, tab or carriage
  return are prefixed before export, so an operator's spreadsheet does not
  execute a client's "name". Covered by unit tests.
- **XLSX.** Written by `src/lib/xlsx.ts` — this repo's own minimal writer, no
  third-party spreadsheet dependency. Strings are XML-escaped; the same formula
  neutralisation applies.
- **URL.** Query parameters are built with `URLSearchParams`, never string
  concatenation. Path segments come from opaque ids.
- **Open redirect.** `safeRedirect`, above. It is the only place in the app that
  redirects to a value taken from input.

## Sensitive data

- **Never in a query string.** Register state — search terms, filters, page —
  stays in React state, because those search terms are client names, account
  numbers and transaction references, and a query string is written to history,
  the `Referer` header, and proxy logs
  ([ADR-0003](adr/0003-register-state-stays-out-of-the-url.md)).
- **Masked by default.** `<MaskedField>` masks IBANs and beneficiary account
  numbers, and revealing one is an explicit action that posts an audit event.
- **The CBL secret key is write-once.** It is transmitted to the backend once,
  never read back, never held in state after submission, and the UI thereafter
  shows a fixed masked placeholder with a "Replace" action. There is no code
  path that displays it in plaintext after saving.
- **No password is ever displayed.** Admin-initiated password reset triggers a
  backend flow; the panel never shows or generates a plaintext password.
- **Nothing persisted beyond the session.** The only things written to browser
  storage are view preferences — theme, sidebar collapse, table density — under
  the `saraf.` prefix. No record data, no identifiers, no credentials.

## Configuration

Every URL, key and name comes from an environment variable, read through
`src/lib/env.ts`, which throws at build/start time when a required variable is
missing. There are no hardcoded base URLs, keys or secrets in `src/` — the
absence is the control, and `env.ts` is the only place `process.env` is read for
these values.

`NEXT_PUBLIC_*` variables are inlined into the client bundle. Nothing secret may
carry that prefix; `AUTH_COOKIE_NAME` is server-only for that reason.

## Dependencies

The runtime dependency list is deliberately short: Next, React, next-intl,
TanStack Query, React Hook Form, zod, recharts, lucide-react, clsx,
tailwind-merge. There is no spreadsheet library, no PDF library, no date
library, and no UI kit — each of those was a place a supply-chain problem could
enter, and each was written instead or done with the platform.

`npm audit` is part of the release checklist rather than a build gate: a
transitive advisory with no reachable path should not stop a deploy at 5pm, and
should not be quietly ignored either.

## What this repository cannot fix

These are real risks, and they are outside the frontend:

1. **CORS and cookie flags.** Credentialed cross-origin calls need
   `Access-Control-Allow-Credentials: true`, an explicit origin, and a cookie
   marked `Secure` (and `SameSite=None` if the panel and API are on different
   sites). Misconfiguration here either breaks sign-in or weakens it, and only
   the deployment can get it right.
2. **Server-side authorization.** Every permission check in this panel is
   advisory. If the backend does not repeat them, the panel's role system is
   decoration.
3. **Rate limiting and lockout** on sign-in. Turnstile raises the cost of
   automation; it is not a lockout policy.
4. **Session lifetime, rotation and revocation.** The panel reacts to a 401. It
   does not decide when one should happen.
5. **Audit log integrity.** The panel emits audit events for reveal actions.
   Whether they are stored tamper-evidently is the backend's question.
6. **HSTS preload and TLS configuration**, which belong to whoever owns the
   domain.

## Reporting

Security issues in this repository should go to the maintainer privately rather
than through a public issue.

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

- **XSS.** No `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`
  or `new Function` anywhere in `src/`, verified by sweep. All output goes
  through React's escaping. PDF export is the browser's own print-to-PDF over
  the page already on screen (`window.print()`), so no second document is built
  and there is no second escaping context to get wrong.
- **Spreadsheet formula injection.** There is no CSV export. Workbooks are
  written by `src/lib/xlsx.ts` — this repo's own minimal writer, no third-party
  spreadsheet dependency — and a `.xlsx` cell cannot carry a formula: formulas
  live in an `<f>` element and this writer emits none. A value beginning `=` is
  written as, and stays, a string. The unit test asserts that property rather
  than the prefixing defence a CSV would have needed.
- **XML injection into the workbook.** Cell text is escaped for `& < > "` and
  stripped of the control characters XML forbids, so a value cannot close its
  own `<t>` element and open an `<f>`. Sheet tab names have Excel's reserved
  characters removed. Both are covered by unit tests.
- **Directional-override spoofing (Trojan Source, display half).** A stored
  string containing U+202A–U+202E or U+2066–U+2069 reorders what is on screen,
  so the operator approving a transfer reads a different string than the one the
  backend holds and the audit record keeps. `src/lib/text-safety.ts` strips
  those characters at three choke points — `clientNames()` (every register cell,
  drawer title, search result), `isolate()` (which would otherwise be closable
  from inside by an unmatched PDI), and the workbook escaper (an override
  survives a round trip and is re-obeyed by Excel). LRM and RLM are deliberately
  kept: they are marks, not overrides, they cannot reorder a run, and they occur
  in ordinary Arabic text. The input half is `directionSafe`, a zod refinement
  on every free-text name, address and bank-name field, which rejects rather
  than silently rewrites — a name the operator typed and a name the system saved
  must be the same string.
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

## Validation sweep

Every attack class below was walked against the actual source, not assumed from
the design. Terminology follows **OWASP ASVS 5.0**; the level column is the
chapter the requirement sits in, and *frontend scope* marks the ones where this
repository can only do half the work and the other half is the backend's.

| Class | ASVS | Verdict | Evidence |
| --- | --- | --- | --- |
| Reflected XSS | V1.2 | Not present | No `dangerouslySetInnerHTML`, no `innerHTML`, no `document.write`, no `eval`, no `new Function` anywhere in `src/` — verified by sweep, kept true by review. React escapes every interpolation. |
| Stored XSS | V1.2 | Not present | Same sinks, same result. Every value from the API is rendered as text; the only markup this app writes is its own. |
| DOM XSS via URL | V1.2 | Not present | The only query parameters read are `reason`, `from` and `status`. `reason` is mapped through a closed set of notice keys; `from` goes through `safeRedirect`; `status` is compared against a tab list. None reaches a sink. |
| CSP bypass | V1.4 | Controlled | Per-request nonce with `'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`. The one relaxation is `style-src-attr 'unsafe-inline'` for chart geometry, split from `style-src` so `<style>` injection stays blocked. `'unsafe-eval'` is development-only. |
| Clickjacking | V1.4 | Controlled | `frame-ancestors 'none'` in the per-request policy and `X-Frame-Options: DENY` in `next.config.ts`. Two mechanisms because one can be stripped by a proxy. |
| CSRF | V4.2 | Controlled (shared) | Double-submit: `X-XSRF-TOKEN` read from the `XSRF-TOKEN` cookie and sent on every non-GET. The session cookie must be `SameSite=Strict` and the token cookie must be readable — both are the backend's to set, and both are listed in DEPLOYMENT.md. |
| Open redirect | V1.3 | Not present | `safeRedirect` accepts only a path that cannot read as an authority: scheme-bearing, protocol-relative, backslash-prefixed and C0-prefixed values all fall back to `/dashboard`. Unit-tested per case. Sign-out navigates to a `new URL(..., window.location.origin)`, not to a value from anywhere. |
| Prototype pollution | V1.5 | Not present | No deep merge exists. The three places untrusted JSON is parsed (`local-store.ts` ×2, the API client) either filter to `string` values through `Object.fromEntries` — which creates own properties, never touching a prototype — or hand the result straight to a typed caller. URL-derived filters are gated on `known.has(key)`. |
| Malicious SVG | V1.2 | Not present | No user-supplied image is ever rendered. `img-src` permits `data:` and `blob:` for the bundled letterhead and the export download only; `object-src 'none'` and the absence of an upload path close the rest. |
| Clipboard abuse | V1.2 | Not present | One `writeText` call, in the build-diagnostics card, over a string this application composed from its own build metadata. Nothing reads the clipboard. |
| Spreadsheet formula injection | V1.2 | Not applicable by construction | `.xlsx` inline strings cannot be formulas; the writer emits no `<f>` element. Asserted as a property in `xlsx.test.ts`. |
| Filename / path injection | V1.2 | Not present | Export filenames are literals or `report-<app-generated date>`. No operator-supplied value reaches `link.download`, and sheet tab names have `[ ] : * ? / \` removed. |
| Unicode / BiDi spoofing | V1.2, V1.5 | Controlled | Stripped on output at three choke points, rejected on input by `directionSafe`. See *Injection and output* above for what is kept and why. |
| Phishing-resistant UI | V6.2 | Controlled | The sign-in form never appears inside the application shell; a session that ends navigates the whole document to `/login?reason=signedOut`, so the operator's address bar is the thing that changes. `from` cannot point off-origin, which is what would otherwise make `/login?from=…` a credible relay. |
| Parameter tampering | V1.3 | Controlled (shared) | Every mutation posts an id the operator already had from an authorised list, and every list is scoped by the session. The frontend cannot enforce that — the backend must re-check ownership on each call. Stated as a backend obligation, not claimed as a control here. |
| Client-side privilege escalation | V8.1 | Controlled (shared) | Permissions gate navigation and actions (`src/lib/authorization.ts`), and the gate is a usability control, not a security boundary: hiding a button is not a decision. The server must deny the call regardless. Documented as such in *Authorization*. |
| Race conditions / double submit | V1.1 | Controlled | Every confirm dialog and form submit is disabled while its mutation is in flight (`Button` sets `disabled` from `loading`), so an approval cannot be fired twice by a double click. Idempotency across tabs or a retried network request is a backend key and is not invented here. |
| Replay | V4.1 | Shared | Cookie-borne sessions with server-side expiry. Nothing replayable is held client-side: no token in `localStorage`, no credential in a URL, no CBL secret retained after it is submitted. |
| Sensitive data in URLs | V1.3 | Not present | The only parameters this app writes are `reason`, `from`, `status` and the register's filter selections. No id that is a secret, no token, no PII. |
| Sensitive data at rest in the browser | V3.1 | Controlled | `localStorage` holds only opaque ids of read notifications. Anything an operator typed is session-scoped or memory-only, because a branch workstation is shared. |

### What a reviewer should re-run

None of the above is a claim about a moment in time; each is a property with a
place to check it.

```bash
npm run check:secrets                       # no credential-shaped string is tracked
npx jest src/lib/__tests__/safe-redirect     # open-redirect cases
npx jest src/lib/__tests__/text-safety       # directional overrides, both halves
npx jest src/lib/__tests__/xlsx              # formula, XML and override behaviour
npx jest src/lib/__tests__/authorization     # permission gating
```

The CSP and the security headers are asserted end-to-end by `e2e/security.spec.ts`
against a production build; a development server relaxes `script-src`, so a
result from `next dev` is not evidence.

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

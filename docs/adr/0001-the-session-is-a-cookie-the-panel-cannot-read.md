# ADR-0001 — The session is a cookie the panel cannot read

- **Status:** accepted
- **Date:** 2026-06-18
- **Applies to:** `src/lib/api/client.ts`, `src/proxy.ts`, `src/components/auth/login-form.tsx`

## Context

The panel needs an authenticated call to a backend on another origin, from a
browser, on machines in branch offices. The two ways to carry that
authentication are a token the JavaScript holds, or a cookie the browser holds.

A token in JavaScript has to be stored somewhere between page loads.
`localStorage` and `sessionStorage` are both readable by any script that runs on
the origin, which means one XSS anywhere in a panel this size — one dependency,
one `dangerouslySetInnerHTML`, one unescaped label — hands over a working
session that outlives the tab. Nothing about a back office makes that trade
worth taking.

## Decision

The session is an httpOnly cookie issued by the backend, scoped to the API
origin. The panel's JavaScript never reads it, never copies it, and never
stores a credential of any kind.

Three things follow, and all three are in the code:

**`credentials: "include"` on every call.** `apiFetch` sends the cookie by
asking the browser to, not by attaching anything. The backend must answer
preflights with `Access-Control-Allow-Credentials: true` and an explicit
`Access-Control-Allow-Origin` — a credentialed request cannot use `*`.

**A double-submit CSRF token.** A cookie the browser attaches automatically is a
cookie a third-party form can make it attach. `csrfHeader()` reads the
non-httpOnly `XSRF-TOKEN` cookie and echoes it in `X-XSRF-TOKEN`; a cross-origin
attacker can cause the request but cannot read the cookie to set the header.
This one cookie is deliberately readable — it is not a credential, and it is
worthless without the httpOnly one beside it.

**Route protection in the proxy, not in the pages.** `src/proxy.ts` checks for
the cookie's presence before any protected route renders and redirects to
`/login` if it is missing. Presence is not validity: the backend decides that,
and a 401 from any call sends the operator back to sign in. The proxy's job is
to stop a signed-out browser from rendering a panel, not to authenticate.

The redirect carries `?from=<path>&reason=session`, and `safeRedirect` in
`src/lib/safe-redirect.ts` refuses anything that is not a bare local path.
`from` is attacker-controlled input on the one screen where the operator is
about to type a password, and a redirect to a look-alike sign-in page is the
whole attack.

## Consequences

- An XSS in the panel can act as the operator while the page is open. It cannot
  export a session to use later, from elsewhere, which is the difference between
  an incident and a breach.
- Server Components cannot fetch panel data: they have no cookie jar and no
  `document`. See `docs/adr/0005-the-panel-renders-in-the-browser.md`, which is
  a consequence of this record rather than an independent decision.
- The backend must be configured for credentialed CORS, and the cookie must be
  `SameSite=None; Secure` if the panel and the API are on different sites. This
  is infrastructure the frontend cannot supply, and it is the first thing to
  check when a deployment authenticates in fixtures mode and fails against the
  real API.
- Fixtures mode writes a non-httpOnly `saraf_session=fixture` cookie purely so
  the proxy has something to read. It is not a credential and no code path
  treats it as one.

## Alternatives considered

**A bearer token in memory only, refreshed on load.** Rejected: the refresh
credential has to live somewhere, and it ends up in storage with the same
exposure, plus a token-refresh path to get wrong.

**A token in `sessionStorage`, cleared on tab close.** Rejected: the window is
shorter, and everything else is identical. A shorter window on a stolen session
is not a defence.

**A BFF holding the session server-side.** Not rejected on merit — it is a
larger change than this decision, and it is the alternative examined in
ADR-0005.

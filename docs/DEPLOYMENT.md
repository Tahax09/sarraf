# Deployment

What this repository needs from an environment, and what it needs from the
backend, to run in production. Infrastructure choices — host, CDN, CI provider —
are deliberately not prescribed here; the requirements are.

## Build and serve

```bash
npm ci
npm run build
npm start          # next start, PORT from the environment
```

The build is a Node server build, not a static export: the proxy sets a
per-request CSP nonce and resolves the locale, so there is a server in the
request path by design. A static host will not run this application correctly.

## Environment

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | client + server | **yes** | Backend origin. No default, no fallback — a missing value throws at startup, before the first request. |
| `NEXT_PUBLIC_APP_NAME` | client | no | Display name in the shell. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | client | no | Public half of the Cloudflare Turnstile pair. Absent means the widget does not render and no token is sent — set it only if the backend verifies one. |
| `NEXT_PUBLIC_API_MODE` | client + server | no | `fixtures` serves the in-memory dataset. **Must be unset in production.** |
| `AUTH_COOKIE_NAME` | server only | no | Name of the httpOnly session cookie the backend issues, so the proxy knows what to look for. Never prefix with `NEXT_PUBLIC_`. |

`NEXT_PUBLIC_*` values are compiled into the client bundle, so they must be
present **at build time**, not only at run time, and nothing secret may carry
that prefix.

Deploying with `NEXT_PUBLIC_API_MODE=fixtures` would serve a fully working panel
backed by fabricated data, with a sign-in that accepts anything. It is the one
misconfiguration here that fails silently and looks fine — check it explicitly.

## What the backend must provide

The panel and the API are separate origins, and the session is a cookie the
panel cannot read
([ADR-0001](adr/0001-the-session-is-a-cookie-the-panel-cannot-read.md)). That
imposes four requirements on the backend's deployment:

1. **`Access-Control-Allow-Origin`** set to the panel's exact origin. A
   credentialed request cannot use `*`.
2. **`Access-Control-Allow-Credentials: true`**, and `X-XSRF-TOKEN` in
   `Access-Control-Allow-Headers`.
3. **The session cookie marked `HttpOnly; Secure`**, plus `SameSite=None` if the
   panel and the API are on different sites. `SameSite=Lax` across sites means
   the cookie is never sent and sign-in appears to succeed and then fails.
4. **An `XSRF-TOKEN` cookie** that is readable by JavaScript, scoped so the
   panel's origin receives it. Without it every non-GET goes out without the
   double-submit header.

If sign-in works in fixtures mode and fails against the real API, it is almost
always one of these four.

## HTTPS and headers

Serve over HTTPS only. The application sets its own security headers —
`next.config.ts` for the static set, `src/proxy.ts` for the per-request CSP —
and a proxy or CDN in front of it **must not** strip, duplicate or override
them. A duplicated `Content-Security-Policy` header is enforced as the
intersection of both, which usually means the nonce stops working and the page
renders without scripts.

Two things are deliberately left to the deployment:

- **HSTS preload.** The header ships `max-age=63072000; includeSubDomains`
  without `preload`. Submitting the domain to the preload list is hard to
  reverse and belongs to whoever owns it.
- **TLS configuration** — protocol versions, ciphers, certificate lifecycle.

The rest of the header set, and why each one is there, is in
[SECURITY.md](SECURITY.md).

## Pre-deploy checklist

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm run check:messages
npm run test:coverage
npm run test:e2e
npm run test:e2e:a11y
npm run perf:budget
npm audit
```

Then, against the deployed URL:

- [ ] `NEXT_PUBLIC_API_MODE` is unset — sign-in rejects a wrong password.
- [ ] Response headers include the CSP with a nonce, HSTS, `X-Frame-Options`,
      `Referrer-Policy`, `Permissions-Policy`, COOP and CORP.
- [ ] The browser console is free of CSP violations on the dashboard and on a
      route with charts.
- [ ] Signing in sets the session cookie, and a hard refresh stays signed in.
- [ ] Signing out clears it, and a protected URL redirects to `/login`.
- [ ] `/ar` and `/en` both render, with `dir` correct on `<html>`.

## Observability

There is none built in. No error reporting service, no RUM, no analytics — the
panel logs nothing to a third party, which is a deliberate default for a system
that displays client account data. Adding an error reporter means adding its
origin to `connect-src` in `src/proxy.ts`, and deciding what may leave the
building before you decide which vendor.

## Rollback

Deployments are immutable builds of a git commit; roll back by redeploying the
previous one. There is no client-side state that survives a deploy — the only
things in browser storage are view preferences under `saraf.` — so no migration
or cache-busting step is needed.

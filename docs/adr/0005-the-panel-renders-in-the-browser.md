# ADR-0005 — The panel renders in the browser, and the boundary is the page

- **Status:** accepted
- **Date:** 2026-08-06
- **Applies to:** `src/lib/api/client.ts`, `src/app/[locale]/**`, every register and record page

## Context

This is a Next.js App Router application, and the App Router's default is that
a component renders on the server unless it says otherwise. Thirty-seven of the
forty `page.tsx` files here open with `"use client"`. That looks like a
framework being used against the grain, and it is worth writing down why it is
not.

The panel does not talk to its own server for data. `apiFetch` calls the
backend directly from the browser:

```ts
fetch(buildUrl(path, params), {
  credentials: "include",
  headers: { ...csrfHeader(), ... },
});
```

Three things follow from those two lines, and together they fix where the
client boundary can sit.

**The API is a different origin.** `env.apiBaseUrl` comes from
`NEXT_PUBLIC_API_BASE_URL` and points at the backend, not at this app. Nothing
in this repository serves `/clients` or `/operations/deposits`.

**The session is an httpOnly cookie on that origin.** `credentials: "include"`
is what sends it. The panel's JavaScript cannot read the cookie — that is the
point of it being httpOnly — so it cannot forward it either.

**The CSRF token is read from `document.cookie`.** `csrfHeader()` pulls
`XSRF-TOKEN` and echoes it in a header: the double-submit pattern, which only
works where a document and its cookies exist.

A React Server Component runs on the panel's server, in a request that carries
no browser cookie jar and no `document`. It cannot make that call. To fetch a
register on the server, the panel would have to become a BFF: accept the
session cookie itself, hold or forward credentials for the backend, and proxy
every endpoint. That is not a refactor of the frontend. It is a second service,
a second place where a session token exists, and a second CSRF surface.

## Decision

Data-bearing pages are client components. The client boundary sits at the page,
and the reason is the transport, not convenience.

What stays on the server is everything that does not need the session:

- both layouts (`src/app/[locale]/layout.tsx` and `(app)/layout.tsx`) — locale,
  direction, fonts, metadata and the message bundle are resolved server-side and
  never hydrate;
- the login and forgot-password pages, which render a client form island rather
  than becoming client pages themselves;
- the locale redirect at `src/app/[locale]/page.tsx`.

Components under `src/components` carry `"use client"` when they use state,
effects, or event handlers. A presentational component imported only by client
pages is already in the client graph, so removing its directive would change no
bytes; the directive is left where it documents an actual requirement and is not
added ceremonially elsewhere.

`error.tsx` files are client components because Next.js requires it — an error
boundary needs a `reset()` the browser can call.

## Consequences

- Every register page hydrates. Measured per-route JavaScript runs from 239 KB
  (roles) to 377 KB (all operations), against a shared baseline of ~239 KB —
  the spread between the lightest and heaviest route is about 140 KB, which is
  the page's own code plus what it pulls in. `e2e/performance.spec.ts` holds the
  budget that keeps it there.
- There is no server-rendered first paint of register data. Pages render their
  skeleton, then their rows. This is honest for a back-office tool behind a
  login, where the first paint is never a cold visitor's first impression.
- The session token exists in exactly one place: an httpOnly cookie scoped to
  the API origin. No copy of it passes through this application's server, and
  this application keeps no server-side session store to be stolen.
- Charts are the one place where the client cost was worth attacking directly,
  and it was: `src/components/charts/index.tsx` loads recharts (~400 kB) through
  `React.lazy` behind a height-reserving placeholder, so only the routes that
  draw a chart pay for one.

## When to revisit

If the backend gains a session model the panel's server can participate in — or
if a BFF is wanted for another reason, such as hiding the API origin entirely —
then register pages can move to RSC and this record should be replaced rather
than amended. The signal to watch is the per-route budget: a route that cannot
be kept under it by splitting its own code is a route arguing for the BFF.

## Alternatives considered

**Proxy every endpoint through Next.js route handlers.** Rejected for now. It
buys server-rendered registers at the cost of a credential-handling service
nobody asked for, and it would put the session in reach of this application's
own logs and error reporting.

**Server-render the static half of each page and hydrate an island for the
table.** Rejected as a real cost for a nominal gain: the header, stat bar and
filters of a register are all driven by the same query as the rows, so the
"static half" is a title.

**Drop `"use client"` from presentational components to look more server-ish.**
Rejected as theatre. Those components are reached only from client pages, so the
directive's presence or absence moves no code across the boundary.

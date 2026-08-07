# Architecture

A back-office panel for a currency-exchange and money-transfer business.
Front end only: every endpoint it calls is expected to exist on a backend that
this repository does not contain and does not mock in production.

## The shape of it

```
browser ──┬─► Next.js (this repo)   HTML, JS, CSS, locale, security headers
          │
          └─► API origin            data, session cookie, CSRF cookie
```

Two origins. The Next.js server renders the shell — layout, direction, fonts,
message catalogue — and never sees a record. Everything with a client, an
account or an operation in it is fetched by the browser directly from the API.
That split is the single most consequential thing about this codebase, and it is
recorded in [ADR-0001](adr/0001-the-session-is-a-cookie-the-panel-cannot-read.md)
and [ADR-0005](adr/0005-the-panel-renders-in-the-browser.md).

## Layers

| Layer | Where | What it owns |
| --- | --- | --- |
| Routing & guards | `src/proxy.ts`, `src/app/[locale]/` | locale prefix, session check, CSP nonce, redirects |
| Pages | `src/app/[locale]/(app)/**/page.tsx` | one route each: queries, columns, layout |
| Modules | `src/components/modules/` | the reusable halves of pages — approval queue, register wizards, edit dialogs |
| Shared | `src/components/shared/` | table, filter bar, export actions, masked field, page furniture |
| UI | `src/components/ui/` | the design system: button, card, dialog, field, tabs, states |
| Data | `src/lib/api/` | client, endpoints, hooks, types, fixtures |
| Domain | `src/lib/` | formatting, permissions, filters, labels, workbook writing |

The dependency direction is one-way: pages import modules import shared imports
ui. Nothing in `ui/` knows what a client or an operation is, which is why the
design system can be read on its own.

### Routing

`src/app/[locale]/` with two groups. `(auth)` holds sign-in and password
recovery, reachable without a session. `(app)` holds everything else behind the
shell — sidebar, header, search overlay — and behind the proxy's session check.

`src/proxy.ts` exports `proxy`, not `middleware`; that is this version of
Next.js, not a naming preference. It does three things per request: resolves the
locale through `next-intl`, redirects an unauthenticated browser to `/login`
with a validated `?from=`, and mints a per-request CSP nonce.

### Data

`src/lib/api/client.ts` is the only place `fetch` is called. It builds the URL
from `env.apiBaseUrl`, sends `credentials: "include"`, echoes the CSRF cookie,
and turns a non-2xx into an `ApiError` carrying the status. Every hook in
`hooks.ts` goes through it; nothing else calls the network.

`endpoints.ts` names every path in one object, `types.ts` describes every
payload, and — because there is no contract document from the backend team —
those two files are the contract. [`docs/API_CONTRACT.md`](API_CONTRACT.md)
writes down what the frontend assumes, so a backend engineer has something to
disagree with.

TanStack Query owns server state. Query keys are built by `qk` in `hooks.ts` so
an invalidation cannot miss a key by spelling it differently. React state owns
everything else; there is no client-side store, and register state deliberately
never reaches the URL ([ADR-0003](adr/0003-register-state-stays-out-of-the-url.md)).

**Fixtures.** `NEXT_PUBLIC_API_MODE=fixtures` swaps the client for an in-memory
dataset that mutates: registering, approving and cancelling all change state for
the life of the process. Every test in this repository runs against it, which is
why the E2E suite exercises real flows rather than stubs.

### Rendering

Thirty-seven of the forty pages are client components. Both layouts, the login
page and the locale redirect are server components. The reason is the transport,
not preference — see ADR-0005, which also states what would have to change for
that to be different.

Charts are the one deliberate code-split: `src/components/charts/index.tsx`
wraps recharts (~400 kB) in `React.lazy` behind a height-reserving placeholder,
so a route that draws no chart never loads one. `e2e/performance.spec.ts`
asserts that this is still true.

### The table

`<DataTable>` is what every register renders. It takes a required `paging` prop
with three possible values, because how a register pages depends on the endpoint
behind it and that decision belongs in the diff
([ADR-0004](adr/0004-table-pagination.md)). It renders a real `<table>` from the
`md` breakpoint up and a card list below it; both layouts show the same rows,
which is why E2E selectors here match on accessible names rather than on `table`.

Its two separable concerns live beside it: `table-pager.tsx` (page window, page
buttons, rows-per-page, range label) and `table-density.tsx` (the session-wide
row-height preference).

### Permissions

`src/lib/permissions.ts` resolves what the signed-in operator may do per module.
`usePermission()` gates actions in the UI, `<RouteGuard>` gates whole pages, and
the nav filters itself from the same source. None of this is a security
boundary — the backend is — and the code says so where it matters.

### Analytics

Six surfaces read the ledger, and each one exists to answer a question the other
five do not. The rule is not "no repeated numbers" — a figure may appear twice
if it is the answer to two different questions — but no surface may exist only
to restate another.

| Surface | The question it answers | Its own data |
| --- | --- | --- |
| Dashboard | Is anything waiting on me, and how has the week moved? | `/dashboard/summary`, `/dashboard/trends`, `/dashboard/currency-balances` |
| Reports (`/core/reports`) | What happened on one specific day? | `/reports?date=` |
| Branch cash flow | Which branch is moving the money? | `/analytics/branch-flow` |
| All operations | Which records, exactly — and of what mix? | `/analytics/all-operations` (paged, filtered) |
| Activity | Who did what, and when? | `/analytics/activity` |
| Top clients | Who holds the money, and how much of the book is that? | `/dashboard/top-clients` + `/dashboard/currency-balances` |

Two consequences are load-bearing:

- The 30-day trend charts and the canonical currency balances live on the
  Dashboard **only**. Other modules link there rather than redraw them.
- Every aggregate says what it was computed from. All operations states its
  sample size in the card subtitle because the backend exposes no aggregate
  endpoint for the ledger, and Top clients drops a currency that
  `currency-balances` does not cover rather than divide by an assumed total
  (`src/lib/concentration.ts`).

## Conventions

- **TypeScript strict.** No `any` in `src/`; `unknown` plus a narrow where a
  payload is genuinely unknown.
- **No string in a component.** Every visible word comes from `messages/`, and
  two gates enforce it ([ADR-0002](adr/0002-arabic-first-and-direction-by-property.md)).
- **Logical properties only.** `ms-`/`me-`/`ps-`/`pe-`/`text-start`, never
  `ml-`/`text-left`.
- **No `dangerouslySetInnerHTML`.** There is none in `src/`, and adding one is a
  security review, not a refactor.
- **Comments explain why.** A comment that restates the line below it is noise;
  a comment naming the alternative that was rejected is the reason the file
  survives its author.

## Where things get decided

| Question | File |
| --- | --- |
| What is a valid environment? | `src/lib/env.ts` — throws at startup on a missing required variable |
| What headers does a response carry? | `next.config.ts` (static) and `src/proxy.ts` (per-request CSP) |
| What paths exist? | `src/lib/api/endpoints.ts` |
| What does the sidebar hold? | `src/lib/nav.ts` |
| What may this operator do? | `src/lib/permissions.ts` |
| How is money written? | `src/lib/format.ts` |

# ADR-0004 — One paging decision per register, stated at the call site

- **Status:** accepted
- **Date:** 2026-08-06
- **Applies to:** `src/components/shared/data-table.tsx`, every page that renders one

## Context

`DataTable` had two optional props for paging: `pagination`, an object that put
the caller in charge, and `paginate`, a boolean that defaulted to `true` and
paged the rows in the browser. Three regimes, expressed two and a half ways:

- seven registers passed `pagination` and paged on the server;
- nine passed `paginate={false}` and showed every row;
- nine passed nothing at all and paged in the browser — not because anyone had
  decided they should, but because that was what the default did.

Nothing was visibly broken. The problem was that a register's paging came from
what its author had *not* written, so the decision never appeared in a diff and
could not be reviewed. Two tables in the second group sat behind endpoints that
page perfectly well on the server. One of them asked for the first ten rows and
rendered them with no pager, underneath a stat bar announcing that the account
had thirty-six movements — the panel named a number the reader had no way to
reach. The other caps its request at fifty, which is right, for a reason that
had never been written down.

Which regime is correct is not a matter of taste. It follows from the endpoint.

## Decision

One required prop, `paging`, with three values, and every `<DataTable>` states
one of them:

| Value | When | What the table does |
| --- | --- | --- |
| `ServerPaging` object | the endpoint returns `Paged<T>` | renders the page it was given; the pager calls back for the next |
| `"client"` | the endpoint returns the whole array | slices in the browser and pages the slices |
| `"none"` | the set is bounded by the contract | renders every row, no pager |

`"client"` is a statement about the endpoint, not a preference. It marks a
register that is waiting for the backend, and this file is the list.

### Endpoints that page (`Paged<T>`)

`/clients` · `/accounts` · `/operations/withdrawals` · `/operations/deposits` ·
`/operations/authorized-withdrawals` · `/operations/external-transfers` ·
`/operations/fund-transfers` · `/operations/currency-exchange-transfers` ·
`/logs` · `/analytics/all-operations`

### Endpoints that return the whole set, behind a `"client"` register

| Endpoint | Register | Size today |
| --- | --- | --- |
| `/users` | Users | grows with the organisation |
| `/settings/currencies` | Currencies | 170 |
| `/settings/countries` | Countries | ~250 |
| `/analytics/activity` | Recent activity | grows with the feed |
| `/dashboard/trends` | Trends table | up to 90 |

Each of these fetches every row and pages what it already holds. That is
correct at today's sizes and wrong at some larger one, and the frontend cannot
fix it: it needs the endpoint to accept `page`/`pageSize` and return `Paged<T>`.

### Endpoints bounded by their own contract, behind `"none"`

`/branches` · `/settings/operations-pricing` · `/reports` ·
`/analytics/branch-flow` · `/dashboard/top-clients` (top ten) ·
`/dashboard/recent-operations` (last eight) · `/dashboard/currency-balances` ·
`/profile/sessions`, and the accounts of one client, capped at 50 in a single
request because the balance cards on that page sum the whole holding.

## Adopting server paging for one of the whole-set endpoints

When an endpoint in the second table starts returning `Paged<T>`, the call site
changes in three places and nowhere else:

1. the hook moves to `usePagedQuery` in `src/lib/api/hooks.ts` — one line, and
   the type of `data` changes from `T[]` to `Paged<T>`;
2. the page adds `useTableQuery(...)` and passes `table.params` to the hook;
3. `paging="client"` becomes the `ServerPaging` object, which is the same five
   fields every server-paged register already passes.

`src/app/[locale]/(app)/core/accounts/[id]/page.tsx` is the worked example: it
made exactly this move in the change that introduced this record.

## Consequences

- Whether a table pages, and who does it, is visible in the JSX and shows up in
  review.
- The whole-set registers are enumerated in one place rather than inferred from
  the absence of a prop, so the backend work has a list.
- Exports follow the same split, and say so: a server-paged register exports the
  page in front of the reader and labels its button accordingly, while a
  `"client"` or `"none"` register exports everything it holds, which is
  everything there is. See `src/components/shared/export-actions.tsx`.
- Adding a register now requires a paging decision. That is the point.

## Alternatives considered

**Keep the two props, document the default.** Rejected: a documented default is
still invisible in the diff, which is where the mistake was being made.

**Page everything in the browser, uniformly.** Rejected: the ledger is ~3,700
rows and the operations registers are larger still. Uniformity bought by
sending a whole ledger to a browser is not a simplification.

**Build a client-side shim that fakes `Paged<T>` over an array**, so every call
site looks server-paged. Rejected as the wrong kind of consistency: it would
make the two cases indistinguishable at the call site, which is precisely the
distinction the backend needs to see.

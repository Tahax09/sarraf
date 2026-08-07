# API contract

The backend exists; its OpenAPI document does not exist in this repository. This
file is what the frontend assumes, written down so a backend engineer has
something concrete to disagree with. Where the two differ, the backend wins and
this file and `src/lib/api/types.ts` get corrected together.

The machine-readable half of this contract is `src/lib/api/endpoints.ts` (every
path) and `src/lib/api/types.ts` (every payload). Nothing outside `src/lib/api/`
defines an API shape.

## Transport

- **Base URL** — `NEXT_PUBLIC_API_BASE_URL`, a different origin from the panel.
- **Requests** — JSON in, JSON out. `Accept: application/json` always;
  `Content-Type: application/json` when there is a body.
- **Credentials** — `credentials: "include"` on every call. The session is an
  httpOnly cookie the panel never reads
  ([ADR-0001](adr/0001-the-session-is-a-cookie-the-panel-cannot-read.md)).
- **CSRF** — every non-GET carries `X-XSRF-TOKEN`, copied from the readable
  `XSRF-TOKEN` cookie the backend sets.
- **CORS** — credentialed, so the backend must answer with an explicit
  `Access-Control-Allow-Origin` (never `*`) and
  `Access-Control-Allow-Credentials: true`.

## Responses

`204` returns nothing. Any other 2xx returns a JSON body. A non-2xx becomes an
`ApiError` and the frontend reads four optional fields:

```jsonc
{
  "message": "Account is closed",  // shown to the operator when present
  "code": "ACCOUNT_CLOSED",        // machine-readable, optional
  "errors": { "amount": "…" }      // field-level, optional
}
```

Status alone drives three behaviours: `401` returns the operator to sign-in,
`403` renders the access-denied panel, and anything else renders the error state
with `message` if there is one. A non-JSON error body is tolerated (the raw text
is kept) but should not happen.

## Lists

A paged endpoint returns this envelope and nothing else:

```ts
type Paged<T> = {
  items: T[];
  total: number;    // every matching record, not items.length
  page: number;     // 1-based, echoed back
  pageSize: number; // echoed back
};
```

`total` must count the whole filtered set. The pager and the "showing 11–20 of
36" label both read it, so a truncated `total` silently hides records.

Standard query parameters on a list endpoint:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | integer ≥ 1 | 1-based page number. Default 1. |
| `pageSize` | integer | Rows per page. The UI offers 10 / 20 / 25 / 50 and defaults to 10. |
| `sort` | `key:direction` | e.g. `createdAt:desc`. Omitted means server default order. |
| `q` | string | Free text over the register's own searchable fields. |
| `dateFrom`, `dateTo` | `YYYY-MM-DD` | **Inclusive** calendar-day bounds, compared against the record's own date in its own timezone. |
| `amountMin`, `amountMax` | number | **Inclusive**, in the row's own currency — the panel does not convert. |

Empty string is not a filter. `?q=&type=` must behave identically to no
parameters at all; the client omits empty values, but the backend should not
depend on that.

Filters compose with AND. `dateFrom` without `dateTo` is an open upper bound.

**Which endpoints are expected to page** is a list, not a rule, and it lives in
[ADR-0004](adr/0004-table-pagination.md) along with the endpoints that return a
whole set today and the three-line change each one needs when it starts paging.
That ADR is the thing to read before adding paging to an endpoint.

## Dates and numbers

- Timestamps on the wire are ISO 8601 with a timezone (`2026-08-06T09:14:00Z`).
- Date-only values are `YYYY-MM-DD`. `/reports?date=` takes one such day.
- Money is a number plus an ISO 4217 currency code, never a formatted string.
  Formatting is the panel's job and depends on the locale.
- Amounts carry up to three decimals (LYD is a three-decimal currency).

## Endpoints

Grouped as `endpoints.ts` groups them. `:id` is an opaque string.

**Session** — `GET /me` · `POST /auth/login` · `POST /auth/login/otp` (only when
the login response asks for a second factor) · `POST /auth/logout` ·
`POST /auth/password-reset/request`.

**Dashboard** — `GET /dashboard/summary` · `/dashboard/trends` ·
`/dashboard/currency-balances` · `/dashboard/top-clients` (top ten) ·
`/dashboard/recent-operations` (last eight). The last three are bounded by the
contract, not by a parameter.

`top-clients` rows carry `balance` **denominated in `currency`** — one
currency's holdings, not a sum across a client's accounts. Top clients divides
that balance by the same currency's total from `currency-balances` to show what
share of the book the ranked clients hold, and a `balance` that mixed currencies
would produce a share of a currency it is not (and can exceed the whole book).
A currency missing from `currency-balances` is dropped from that panel rather
than shown against an assumed total.

**Registers** — `GET|POST /clients` · `GET|PATCH /clients/:id` ·
`GET|POST /accounts` · `GET|PATCH /accounts/:id` ·
`GET /accounts/:id/balance`.

**Operations** — `GET|POST /operations/withdrawals` · `/operations/deposits` ·
`/operations/authorized-withdrawals` · `/operations/external-transfers` ·
`/operations/fund-transfers` · `/operations/currency-exchange-transfers`.
Approval and cancellation are `POST .../:id/approve` and `POST .../:id/cancel`
on the two queues that have them. `GET /exchange-rate` quotes a pair.

**Settings** — `/settings/operations-pricing` · `/settings/currencies` (+`/:id`)
· `/settings/operation-rules` · `/settings/system-info` · `/settings/countries`
(+`/:code`, an ISO 3166-1 alpha-2 code, not an id).

**Administration** — `/branches` (+`/:id`) · `/users` (+`/:id`) ·
`POST /users/:id/password-reset` · `/roles` (+`/:id`) · `GET /logs`.

**Reporting** — `GET /reports?date=YYYY-MM-DD` returns one day's snapshot for
every branch plus a seven-day trailing series ending on that date.
`GET /analytics/branch-flow` · `/analytics/all-operations` (paged, filtered) ·
`/analytics/activity`.

**Profile** — `GET /profile/sessions` · `DELETE /profile/sessions/:id` ·
`PUT /profile/password`.

**CBL** — `GET|PUT /cbl/connection` · `POST /cbl/connection/test`. The secret key
is write-only: the panel sends it once and the `GET` must never return it, in
any form, masked or otherwise. Returning it would put it in a response body, a
browser cache and possibly a log, which is the whole reason the field is
write-once.

## Fixtures

`NEXT_PUBLIC_API_MODE=fixtures` serves this contract from memory
(`src/lib/api/fixtures/`), including paging, sorting, filtering and mutations.
It is the reference implementation of the rules above and every test in the
repository runs against it — so a disagreement between the fixtures and this
document is a bug in one of them.

## Open questions for the backend

1. Do the whole-set endpoints listed in ADR-0004 (`/users`,
   `/settings/currencies`, `/settings/countries`, `/analytics/activity`,
   `/dashboard/trends`) accept `page`/`pageSize`? The panel is ready for them.
2. Is `total` on a paged response the filtered count or the table count?
   The panel assumes filtered.
3. Are `dateFrom`/`dateTo` compared in UTC or in branch-local time? The panel
   sends a calendar day and assumes the backend resolves it the way the
   operator means it.
4. Does the error body use `code` consistently enough to drive UI decisions? The
   panel currently branches on status only.
5. What is the session lifetime, and is there a refresh? The panel reacts to a
   `401`; it does not schedule anything.

# ADR-0003 — Register state stays out of the URL

- **Status:** accepted
- **Date:** 2026-07-28
- **Applies to:** `src/lib/use-table-query.ts`, `src/lib/search/provider.tsx`, every register page

## Context

Every register in the panel carries state that a reader manipulates: a page
number, a sort column, a set of filters, and a search term. The web's default
home for that state is the query string, which buys back-button navigation and
linkable views for free.

What those registers search over, though, is a money-transfer back office. The
search box on the clients register takes a client's name; on the accounts and
operations registers it takes an account number, and on the ledger a
transaction reference. The filters take branch, currency and date ranges that,
combined with a name, describe one person's business.

A query string is not a private place. It is written to browser history and to
the profile that syncs it between devices, sent in the `Referer` header of the
next outbound request, recorded in proxy and CDN access logs, kept in bookmarks
and in the "recently visited" surfaces of the browser and the OS, and pasted
verbatim into chat when an operator asks a colleague to look at something.

## Decision

Register state — page, page size, sort, filters, search term — is held in React
state by `useTableQuery` and never serialised into the URL. The same rule
applies to the global search overlay: the term lives in `SearchProvider` state
and is not persisted to `localStorage` or `sessionStorage` either.

A register's URL identifies the register. A record's URL identifies the record
by its opaque id, which is already visible to anyone who can reach the page.

## Consequences

- No personal data enters browser history, referrer headers, or any log that
  records request lines.
- The back button moves between pages of the panel, not between states of one
  register. Turning a page and pressing back leaves the register.
- A register view is not linkable: "look at page 4 of the ledger filtered to
  Tripoli" has to be described rather than sent.
- Reloading a register returns it to its first page with filters cleared.

The linkability cost is real and was accepted. Where a colleague needs to be
sent something specific, the record pages are linkable, and the export produces
a file that carries the filter in its own header.

## Alternatives considered

**Everything in the query string.** Rejected on the exposure above.

**Non-sensitive state in the URL, search and filters in memory.** Rejected as
worse than either whole: the reader cannot tell which half of the register's
state survives a reload, and a filter that is one release away from becoming
sensitive migrates without anyone noticing.

**Encrypted or hashed state in the URL.** Rejected as machinery in service of
a feature nobody had asked for. It also does not remove the string from history
or logs; it only makes it unreadable to whoever is reading them today.

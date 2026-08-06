# Performance

The operators are on branch-office machines and Libyan mobile connections. The
number that matters here is not a lab score, it is how much JavaScript a page
makes someone wait for, so that is the number this repository holds to account.

## The budget

| Bound | Value | What it protects |
| --- | --- | --- |
| Per route, total JS transferred | **460 KB** | one route pulling in something heavy |
| The lightest route (≈ the shared baseline) | **300 KB** | a dependency landing in the shared graph, where every route pays for it |
| Chart route − chartless route | **> 50 KB** | recharts (~400 kB raw) staying lazy instead of quietly becoming eager |

These are compressed bytes — `encodedBodySize`, what actually crossed the wire.

## How it is enforced

```bash
npm run perf:budget
```

That script builds a production bundle, serves it on port 3200, and runs
`e2e/performance.spec.ts` against it. The spec navigates five routes chosen to
bracket the range, reads `PerformanceResourceTiming` in the real browser, and
fails if any route is over budget.

It is **skipped** in the normal E2E suite unless `E2E_PROD=1`, because the
default server is `next dev` and unminified chunks would make any threshold
meaningless. A budget that passes for the wrong reason is worse than none.

The run prints the table whether it passes or fails, so a green run is also the
record of where the routes sat that day.

### Measured, most recent run

| Route | KB |
| --- | --- |
| `/core/analytics/all-operations` | 377 |
| `/dashboard` | 370 |
| `/core/analytics/branch-cash-flow` | 368 |
| `/core/withdrawal/list` | 247 |
| `/core/roles` | 239 |

The budgets sit above these with room for ordinary growth. They are ceilings to
catch a regression, not targets to grow into — a change that adds 40 KB to every
route should be argued for in the pull request, not absorbed silently because
there was headroom.

> **Why there is no "First Load JS" table here.** This version of Next.js with
> Turbopack does not print per-route size columns at build time. Measuring in
> the browser is not a workaround for that; it is the more honest measurement,
> because it counts what the route actually pulled rather than what the graph
> predicted.

## What makes the numbers what they are

**Charts are the one code-split.** `src/components/charts/index.tsx` wraps
recharts in `React.lazy` behind a placeholder that reserves the chart's height,
so the split costs no layout shift. A route that draws no chart never downloads
one, which is the whole 130 KB gap between `/core/roles` and
`/core/analytics/branch-cash-flow`.

**No heavyweight dependency was adopted.** There is no spreadsheet library
(`src/lib/xlsx.ts` writes the workbook), no PDF library (the browser's own print
pipeline produces the PDF), no date library (`Intl` and ISO strings), and no
component library. Each of those would have been 30–300 KB on every route.

**The React Compiler is on** (`reactCompiler: true`), which is why there is
almost no hand-written `useMemo`/`useCallback` in the codebase. Memoisation
written by hand is code to maintain and a place to get dependencies wrong.

**Server state has one owner.** TanStack Query dedupes, caches and invalidates
by key; nothing fetches twice for the same data on the same screen.

**Fonts are self-hosted through `next/font`**, so there is no render-blocking
request to a third-party origin and no FOUT from a late stylesheet.

## Rendering and the runtime

Thirty-seven of the forty pages are client components, for a transport reason
rather than a preference — the session is an httpOnly cookie on another origin,
so the server has nothing to fetch with
([ADR-0005](adr/0005-the-panel-renders-in-the-browser.md)). The performance
consequence is stated there rather than hidden: the shell is server-rendered and
the data arrives after hydration.

The mitigation is that no screen waits on a blank frame. Every route has a
skeleton with the shape of its content, every table reserves its row height, and
every chart reserves its box — so the load sequence is stable rather than
jumping, and Cumulative Layout Shift stays near zero by construction rather than
by tuning.

A BFF would let the first screenful come from the server and would cut the
per-route JS meaningfully. It is the named revisit condition in ADR-0005, and it
is the single biggest performance change available to this codebase.

## Runtime behaviour worth knowing

- **Server paging where the endpoint supports it.** The ledger and the operation
  registers page on the server, so a large register never ships a large array to
  the browser. Which register does what, and why, is
  [ADR-0004](adr/0004-table-pagination.md).
- **Tables render two layouts** — a real `<table>` from `md` up, a card list
  below — and only one is in the DOM at a time.
- **The dashboard fires several queries in parallel**, each with its own
  skeleton, so one slow endpoint does not hold the page.

## What is not measured

Named rather than implied:

1. **No Core Web Vitals field data.** LCP, INP and CLS are not collected from
   real users. There is no RUM endpoint, and adding one is a deployment
   decision.
2. **No Lighthouse gate.** Lab scores on a fixtures build measure the fixtures,
   and a score that moves with the runner's CPU is not a gate.
3. **Backend latency is out of scope.** Every number above is bytes and browser
   work. How long `/analytics/all-operations` takes to answer is the backend's
   question, and it will dominate the user's experience of that page.
4. **No image budget.** The panel ships almost no raster imagery; if that
   changes, this file needs a second table.
5. **Only five routes are measured.** They bracket the range — heaviest and
   lightest — rather than covering all forty. A regression confined to an
   unmeasured route would not be caught.

## Changing a budget

Raising a number in `e2e/performance.spec.ts` is allowed, and it is a reviewed
change like any other: say in the pull request what got bigger and why the size
is worth it. The point of the constant is not that it never moves — it is that
moving it is visible.

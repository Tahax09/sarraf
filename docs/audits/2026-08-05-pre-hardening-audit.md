# Saraf Admin Panel — Frontend Architecture & Production Readiness Audit

> **Historical snapshot — 2026-08-05. Superseded; do not read as current.**
>
> This is the audit that started the production-hardening work, kept because the
> findings explain why the codebase changed. Most of what it reports as missing
> now exists: CSP and the full header set, route-level authorization, error
> boundaries, server paging, the skip link, linked field errors, named dialogs,
> lazy charts, coverage thresholds, and the documentation whose absence it
> scores 6.5.
>
> Line references are to the tree as it stood on 2026-08-05 and have drifted;
> `src/middleware.ts` in particular is now `src/proxy.ts`, and the links point at
> the successor.
>
> For the current state read [ARCHITECTURE](../ARCHITECTURE.md),
> [SECURITY](../SECURITY.md), [ACCESSIBILITY](../ACCESSIBILITY.md),
> [PERFORMANCE](../PERFORMANCE.md) and the [ADRs](../adr/README.md). Where this
> file and those disagree, those are right.

**Scope:** the entire front-end repository as it stands at the date of this document.
**Method:** read-only inspection of every source file, plus a clean `next build`, `tsc --noEmit`,
`next lint` and the full Jest suite. No code was modified to produce this report.
**Out of scope:** the backend and its API implementation. Every claim below is anchored to a file
and, where useful, a line number.

---

## 1. Executive Summary

| Dimension | Score | One-line justification |
| --- | --- | --- |
| Overall project quality | **8.0 / 10** | Coherent, disciplined, well-commented codebase with a real design system; the gaps are structural, not sloppiness. |
| Production readiness | **6.0 / 10** | No error boundaries, no CSP, no CI, silent row truncation on large datasets, 4 placeholder routes in the live nav. |
| Maintainability | **8.5 / 10** | Strong reuse (`DataTable` in 19 places, `PageHeader` in 29), one API layer, one token file, zero TODO/FIXME, zero `console.*`. |
| Architecture | **7.0 / 10** | Layering is clean and consistent, but the App Router is used as an SPA shell — 36 of 37 pages are client components. |
| UX implementation | **8.5 / 10** | Genuine RTL/LTR, mobile card fallbacks, full-screen sheets, confirm gates, empty/error/loading states everywhere. |
| Accessibility | **7.0 / 10** | Serious effort (native `<dialog>`, `aria-current`, captions, reduced-motion) undone by four systematic defects: unlinked field errors, unnamed dialogs, an untrapped mobile drawer, no skip link. |
| Security | **7.5 / 10** | httpOnly-cookie auth, CSRF double-submit, CSV-injection escaping, no `dangerouslySetInnerHTML`, no client-side token storage — but no CSP/HSTS and no route-level authorization. |
| Documentation | **6.5 / 10** | An excellent README; nothing else. No ADRs, no component docs, no contribution or deployment guide. |
| Performance | **6.5 / 10** | 2.1 MB of client chunks, a 404 KB recharts chunk on the critical path, zero `Suspense`/`next/dynamic`/`lazy`, every route dynamic. |
| Testing | **6.5 / 10** | 51 unit tests + 32 Playwright tests, all passing, and the E2E specs catch real runtime-only bugs — but no coverage gate, no CI, and the API client, middleware and permission logic are untested. |

**Verdict in one paragraph.** This is a well-built front end by a developer who clearly cared: the
naming is consistent, the comments explain *why* rather than *what*, the i18n discipline is real
(450 keys, zero drift between `ar` and `en`), and the security posture is better than most
production admin panels. It is not yet production-ready, and the reasons are concentrated in four
places: nothing catches a render error, nothing enforces permissions at the route level, tables
silently truncate large result sets, and there is no CSP or CI. All four are fixable in days, not
weeks.

---

## 2. Repository Health

### 2.1 Strengths (explicitly good — keep these)

1. **Environment discipline is exemplary.** `src/lib/env.ts` throws
   `[env] Missing required environment variable:` at module load. No base URL, key or secret appears
   anywhere in `src/`. `.env.example` documents each variable and marks `AUTH_COOKIE_NAME` as
   server-only. `.gitignore` covers `.env*` and `*.pem`.
2. **Auth handling matches the specification exactly.** `src/middleware.ts` reads only an httpOnly
   cookie name from `process.env.AUTH_COOKIE_NAME`, and the redirect carries the path only —
   `/login?from=<path>` with the comment "never put tokens or PII in query strings"
   ([src/middleware.ts](../../src/proxy.ts)). There is no `localStorage`/`sessionStorage` use
   anywhere in the repo.
3. **CSRF is handled correctly.** `csrfHeader()` in [src/lib/api/client.ts](../../src/lib/api/client.ts)
   reads the `XSRF-TOKEN` cookie and echoes it as `X-XSRF-TOKEN` on non-GET requests only, with
   `credentials: "include"`.
4. **CSV injection is neutralized.** `escapeCell()` in [src/lib/export.ts:10](../../src/lib/export.ts#L10)
   prefixes any cell starting with `= + - @ \t \r` with an apostrophe. Very few teams remember this.
   PDF export uses the browser print pipeline, so no PDF library ships to the client.
5. **Fixture data does not leak into a production build — verified, not assumed.** A build with
   `NEXT_PUBLIC_API_MODE=live` contains no fixture strings; the dynamic import behind the
   `usingFixtures` constant is fully tree-shaken. The 501-line fixture dataset is a dev-only cost.
6. **Design tokens are genuinely centralized.** [src/app/globals.css](../../src/app/globals.css) defines
   three brand primitives and derives every surface, accent, chart series and shadow from them, for
   both themes, with `@theme inline` exposing them to Tailwind. No gradients. Two deliberate
   deviations (light `--color-success` darkened, dark `--color-accent` lifted) are documented inline
   with their AA rationale.
7. **Component reuse is real, not aspirational.** `DataTable` is used by 19 modules, `PageHeader` by
   29, `HeaderStatBar` by 16, `DetailDrawer` by 12, `ConfirmDialog` by 8. Three module-level
   abstractions (`approval-queue`, `simple-operation-list`, `transfer-list`) each serve two routes.
8. **i18n is airtight.** 450 keys in each catalogue, zero keys present in one and missing from the
   other. Only three values are identical across languages (`common.notAvailable`, `nav.ceft`,
   `fields.iban`) and all three are correct — a dash and two acronyms. A regression test guards
   against raw key leakage.
9. **RTL is implemented, not simulated.** Logical properties (`ps-`/`pe-`/`ms-`/`insetInlineStart`)
   throughout, a `.numeric` class that isolates LTR numerals inside RTL text, and an `.rtl-flip`
   utility for directional icons.
10. **The build is clean.** `next build` succeeds, `tsc --noEmit` reports nothing, `next lint`
    reports 0 errors, all 51 Jest tests and 32 Playwright tests pass.

### 2.2 Weaknesses

- The App Router is used purely as a routing shell. 70 files carry `"use client"`; 36 of 37
  `page.tsx` files are client components. Server Components, streaming and server-side data fetching
  are entirely unused.
- Zero `Suspense`, zero `next/dynamic`, zero `React.lazy` in `src/`. No `loading.tsx`, `error.tsx`,
  `not-found.tsx` or `global-error.tsx` anywhere.
- Pagination is a client-side illusion over a truncated fetch.
- Authorization exists as a data structure (`src/lib/permissions.ts`) but is applied in exactly one
  place — the sidebar's visibility filter.
- Four accessibility defects are systematic rather than local: they live in shared components, so
  they reproduce on every screen.
- Documentation stops at the README.

### 2.3 Risks

| Risk | Likelihood | Impact | Trigger |
| --- | --- | --- | --- |
| A render throw white-screens the operator mid-approval | Medium | High | Any unexpected API shape or null field reaching a chart or table cell |
| An operation is invisible because it fell past the fetch cap | Medium | High | Branch exceeds 500 operations in the filtered window |
| A user reaches a page their role forbids and gets a generic error | High | Medium | Direct URL entry, bookmark, or a stale tab after a role change |
| XSS payload executes with no CSP as a second line of defence | Low | High | Any injection point introduced later; React alone is the only defence today |
| A regression ships because nothing runs the suite | Medium | Medium | Any commit — there is no CI |

### 2.4 Technical debt inventory

| Item | Size | Notes |
| --- | --- | --- |
| `virtualize` prop + `@tanstack/react-virtual` | Small | Zero usages in app code; the dependency still ships |
| Deprecated `middleware` convention | Small | Build warns every run; codemod exists |
| 6 `as unknown as Record<string, unknown>[]` casts at chart boundaries | Small | Chart props typed too loosely |
| 4 `ComingSoon` routes in the live navigation | Small | `ubs`, `cbl/contracts`, `cbl/exchange-rates`, `cbl/purchase-requests` |
| 603-line dashboard page | Medium | Six local components in one file; readable, but the largest file in the repo |
| Client-only pagination | Large | Touches 19 tables and the API hook layer |
| Client-only rendering | Large | Architectural; not urgent for an internal panel |

### 2.5 Scalability assessment

**Code scalability: good.** Adding a nineteenth register page means writing a page that composes
`PageHeader` + `HeaderStatBar` + `DataTable` and one hook in `src/lib/api/hooks.ts`. The permission
module list, nav tree, label domains and query-key namespace are all single-source. A new developer
can ship a CRUD screen in a day.

**Data scalability: poor.** Every list route fetches a fixed slab (100–500 rows) and paginates it in
the browser. At 10× today's fixture volume the UI is wrong, not just slow — rows past the cap simply
do not exist as far as the operator is concerned, and nothing on screen says so.

**Team scalability: fair.** No CI, no formatter, no pre-commit hooks, no ADRs. Conventions live in
one developer's head and in the README; a second contributor has nothing enforcing them.

---

## 3. Findings

### CRITICAL

---

**C-1 · No error boundary exists at any level of the application**

- **Affected:** `src/app/**` (absence), `src/app/[locale]/layout.tsx`
- **Evidence:** `find src/app -name "error.tsx" -o -name "global-error.tsx"` returns nothing.
  `grep -rn "ErrorBoundary\|componentDidCatch" src/` returns nothing. The only error handling is
  per-query: `ErrorState` in [src/components/ui/states.tsx:56](../../src/components/ui/states.tsx#L56),
  which renders when a TanStack Query rejects.
- **Explanation:** Query failures are handled well. Render failures are not handled at all. A single
  `undefined` reaching a chart accessor, a `toFixed` on a null amount, or a malformed date in a cell
  unmounts the entire React tree and leaves a blank page with no recovery path. In a money-movement
  back office the operator may be mid-approval when it happens, with no indication of whether the
  action was submitted.
- **Recommendation:** Add `src/app/[locale]/error.tsx` (segment-level, with a reset button and a
  localized message) and `src/app/global-error.tsx` (catches layout-level throws, must render its own
  `<html>`/`<body>`). Optionally a narrower boundary around `src/components/charts` since third-party
  chart rendering is the most likely thrower.
- **Effort:** S — under half a day.
- **Impact:** Converts an unrecoverable white screen into a recoverable, localized error panel.

---

**C-2 · Permissions gate navigation only; no route enforces them**

- **Affected:** [src/lib/permissions.ts](../../src/lib/permissions.ts),
  [src/components/layout/sidebar.tsx:37](../../src/components/layout/sidebar.tsx#L37),
  [src/middleware.ts](../../src/proxy.ts), all 37 pages
- **Evidence:** `grep -rn "\bcan(" src/` returns exactly one call site — the sidebar's item filter.
  `useCurrentUser` is consumed in only three components (`app-shell`, `users`, `profile`). The
  middleware checks for the presence of a session cookie and nothing else.
- **Explanation:** A `PERMISSION_MODULES` list of 22 modules and a `MODULE_ACTIONS` matrix exist and
  are used to render the roles editor, but no page consults them. A user without `users:view` who
  types `/core/users` gets the full page shell, the header stat bar, the filter controls and a
  request that the backend rejects — surfacing as the generic "something went wrong" state rather
  than a "you do not have access" state. The real control is server-side and presumably present;
  the frontend gap is a defence-in-depth and UX failure, not an authorization bypass. It also means
  action buttons (delete, approve) render for users who cannot perform them.
- **Recommendation:** Two layers. (a) A small `usePermission(module, action)` hook plus a
  `<RequirePermission>` wrapper rendering a localized 403 state — apply it once per page, next to
  the existing `PageHeader`. (b) Gate destructive row actions on the same check so the buttons do
  not render. Do **not** move this into middleware unless the session cookie can be read
  server-side without an extra round trip.
- **Effort:** M — 1–2 days for 37 routes.
- **Impact:** Correct 403 experience, no unauthorized action affordances, ASVS-aligned layered
  authorization.

---

**C-3 · Tables paginate a truncated fetch; rows past the cap silently disappear**

- **Affected:** [src/app/[locale]/(app)/core/analytics/all-operations/page.tsx:44](../../src/app/[locale]/(app)/core/analytics/all-operations/page.tsx#L44)
  (`pageSize: 500`), [core/logs/page.tsx:36](../../src/app/[locale]/(app)/core/logs/page.tsx#L36) (200),
  [core/accounts/page.tsx:31](../../src/app/[locale]/(app)/core/accounts/page.tsx#L31) (200),
  [core/clients/list/page.tsx:24](../../src/app/[locale]/(app)/core/clients/list/page.tsx#L24) (100),
  `simple-operation-list.tsx:57` (100), `transfer-list.tsx:54` (100), `approval-queue.tsx:245` (100),
  plus `useAccounts({ pageSize: 500 })` called three separate times for lookup data
- **Evidence:** The API contract has a `Paged<T>` type with `total`, `page` and `pageSize`
  ([src/lib/api/types.ts:16](../../src/lib/api/types.ts#L16)), but no call site ever passes a `page`
  parameter or reads `total`. `DataTable` slices the array it is handed:
  `const pageRows = paginate ? rows.slice(offset, offset + pageSize) : rows`
  ([src/components/shared/data-table.tsx](../../src/components/shared/data-table.tsx)).
- **Explanation:** The pager reports "1–10 of 500" when the server holds 12,000 matching rows. There
  is no truncation notice, no "load more", nothing. For a ledger and an audit log this is a
  correctness defect, not a performance one: an operator searching for a transaction that exists can
  be told, in effect, that it does not. It also means each of those routes transfers up to 500 fully
  hydrated records on mount.
- **Recommendation:** Wire the existing `Paged<T>` contract through. `DataTable` grows an optional
  controlled mode (`page`, `pageCount`, `onPageChange`, `total`) and falls back to today's
  client-side behaviour when those props are absent, so the seven small tables need no change. Then
  convert the six high-volume routes. As an interim mitigation (hours, not days), render a visible
  notice when `rows.length === requestedPageSize`.
- **Effort:** L — 3–5 days for the full conversion; ~2 hours for the interim notice.
- **Impact:** Correct result sets, constant-size payloads, and the table stops being the scalability
  ceiling of the product.

---

### HIGH

---

**H-1 · No Content-Security-Policy and no Strict-Transport-Security header**

- **Affected:** [next.config.ts](../../next.config.ts)
- **Evidence:** `headers()` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy`. No `CSP`, no
  `Strict-Transport-Security`.
- **Explanation:** The four headers present are the right four to start with, and the app has no
  `dangerouslySetInnerHTML` (verified: zero occurrences), so React's escaping is doing real work.
  But CSP is the control that contains an XSS if one is ever introduced, and it is also what stops
  a compromised dependency from exfiltrating to an arbitrary origin — a meaningful concern for a
  panel that renders IBANs and account numbers. OWASP Top 10 A05:2021.
- **Recommendation:** Add a nonce-based CSP. Tailwind v4 and next-intl need no `unsafe-eval`; Next's
  inline bootstrap script needs a nonce, generated in the middleware and read via `headers()` in the
  root layout. Start in `Content-Security-Policy-Report-Only`, then enforce. Add
  `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (only meaningful behind
  TLS — confirm the deployment terminates HTTPS at or before the app).
- **Effort:** M — 1 day including report-only observation.
- **Impact:** Closes the largest remaining gap between this app and an ASVS L2 posture.

---

**H-2 · Field validation errors are not programmatically associated with their inputs**

- **Affected:** [src/components/ui/field.tsx:46](../../src/components/ui/field.tsx#L46) — therefore
  every form in the application
- **Evidence:** `Field` renders `<p role="alert">{error}</p>` as a sibling of the control. The
  control receives `aria-invalid` but never `aria-describedby`. The same applies to `hint`.
- **Explanation:** A screen reader user who tabs back to a failed field hears the label and "invalid
  entry" but never the reason. `role="alert"` announces once, at the moment of insertion, and is lost
  thereafter. WCAG 2.2 SC 3.3.1 (Error Identification) and 1.3.1 (Info and Relationships). Because
  the defect is in the shared `Field`, it reproduces across every form — registration wizards,
  countries CRUD, users, pricing, login.
- **Recommendation:** Generate `const errorId = \`${id}-error\`` and `const hintId = \`${id}-hint\``
  inside `Field`, put them on the `<p>` elements, and pass
  `aria-describedby={[error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined}` to
  the control. One component, roughly fifteen lines.
- **Effort:** S — under 2 hours including a test.
- **Impact:** Fixes an entire WCAG failure class application-wide in one edit.

---

**H-3 · Dialogs have no accessible name**

- **Affected:** [src/components/ui/dialog.tsx:59](../../src/components/ui/dialog.tsx#L59) and every
  caller
- **Evidence:** The `<dialog>` sets `aria-labelledby={labelledBy}`, but the heading it renders
  (`<h2>{title}</h2>`, line 79) carries no `id`, and no call site in the repository passes
  `labelledBy`.
- **Explanation:** Building on the native `<dialog>` element was the right call — focus trapping,
  Escape and inertness come from the platform and the implementation is correct. But `aria-labelledby`
  resolving to `undefined` means assistive technology announces "dialog" with no name, on every
  confirmation, every add/edit form, and every detail drawer. WCAG 2.2 SC 4.1.2.
- **Recommendation:** Generate an id with `useId()` inside `Dialog`, put it on the `<h2>`, and use it
  for `aria-labelledby` whenever `title` is present, keeping the `labelledBy` prop as an override.
  Add `aria-describedby` for `description` on the same pass.
- **Effort:** S — under an hour.
- **Impact:** Names every modal in the app; also improves `ConfirmDialog`, which is the gate on every
  destructive action.

---

**H-4 · The mobile navigation drawer is a modal that behaves like a div**

- **Affected:** [src/components/layout/app-shell.tsx:111-139](../../src/components/layout/app-shell.tsx#L111-L139)
- **Evidence:** A `fixed inset-0 z-50` container with a full-bleed `<button>` backdrop. No
  `role="dialog"`, no `aria-modal`, no focus move on open, no focus restore on close, no Escape
  handler, and the page behind remains in the tab order.
- **Explanation:** Keyboard and screen-reader users can tab straight out of the open drawer into the
  content underneath, which is visually covered. Escape does nothing. WCAG 2.2 SC 2.1.2 (No Keyboard
  Trap — inverted: focus escapes when it should not) and 2.4.3 (Focus Order). Note the same file gets
  the *other* mobile-first calls right: a bottom nav sized for thumbs, `aria-current="page"`, and the
  route-change auto-close at line 27.
- **Recommendation:** Reuse the existing `Dialog` with `variant="sheet"` — it already provides
  platform focus trapping, Escape and inertness, and already renders full-screen on mobile. That
  replaces roughly 28 lines with a wrapper and removes a divergent pattern.
- **Effort:** S — half a day.
- **Impact:** Correct modal semantics on the primary mobile navigation, and one fewer bespoke overlay.

---

**H-5 · No skip link; keyboard users traverse the full navigation on every page**

- **Affected:** [src/components/layout/app-shell.tsx](../../src/components/layout/app-shell.tsx)
- **Evidence:** `grep -rni "skip" src/ messages/` finds only unrelated code comments. `<main>` at
  line 105 has no `id` and no `tabIndex`.
- **Explanation:** The sidebar renders up to 22 permission-filtered links plus group toggles, and it
  is repeated on every route. A keyboard user tabs through all of it before reaching page content,
  every single navigation. WCAG 2.2 SC 2.4.1 (Bypass Blocks) — Level **A**, the only Level A failure
  in this audit.
- **Recommendation:** Add `<a href="#main" className="sr-only focus:not-sr-only …">{t("skipToContent")}</a>`
  as the first child of the shell, and `id="main"` plus `tabIndex={-1}` on `<main>`. Two message keys.
- **Effort:** S — under an hour.
- **Impact:** Clears the audit's only Level A failure.

---

**H-6 · The App Router is used as a client-side SPA shell**

- **Affected:** 36 of 37 `page.tsx` files; 70 files total carry `"use client"`
- **Evidence:** Only `src/app/[locale]/page.tsx` (a redirect) is a server component. Zero
  occurrences of `Suspense`, `next/dynamic` or `lazy(` in `src/`. Every route in the build output is
  marked `ƒ (Dynamic)`. Client chunks total 2.1 MB, the largest single chunk being 404 KB and
  containing recharts.
- **Explanation:** Every page ships its full component tree plus its data-fetching logic to the
  browser, then waterfalls: hydrate → mount → fire query → skeleton → render. Nothing streams. The
  recharts chunk loads for users who never open a chart page. This is a legitimate architectural
  choice for a heavily interactive internal panel — the app is behind auth, SEO is irrelevant, and
  TanStack Query genuinely wants a client boundary — so it is not a defect in the way C-1 to C-3 are.
  But it is being paid for without the compensating measures: no code splitting, no streaming, no
  route-level loading UI.
- **Recommendation:** Do not rewrite. Take the cheap wins in order:
  (a) `next/dynamic` around `src/components/charts` with `ssr: false` — one edit, removes the largest
  chunk from every non-chart route;
  (b) add `loading.tsx` per route group so navigation paints a skeleton instantly instead of a blank
  `<main>`;
  (c) where a page is a shell around one client island (e.g. `settings/*`), make the page a server
  component and push `"use client"` down to the island.
- **Effort:** (a) S, (b) S, (c) L and optional.
- **Impact:** (a) alone is likely a 300–400 KB reduction on most routes.

---

**H-7 · Focus indicator is suppressed on every form control**

- **Affected:** [src/components/ui/field.tsx:15](../../src/components/ui/field.tsx#L15) (`CONTROL`),
  [src/components/layout/app-shell.tsx:82](../../src/components/layout/app-shell.tsx#L82),
  [src/components/shared/masked-field.tsx:140](../../src/components/shared/masked-field.tsx#L140)
- **Evidence:** `CONTROL` includes `focus:border-accent focus:outline-none`. `globals.css` defines a
  global `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px }`, but
  Tailwind's `.focus\:outline-none:focus` has higher specificity (0,2,0 vs 0,1,0) and wins.
- **Explanation:** Focused inputs are indicated by a border colour change only — grey `#e3e5e3` to
  blue `#0056f5`. That is a change of colour on a 1px border, adjacent to a white field, which is a
  weak and easily-missed indicator, and it is the *only* indicator because the global ring is
  overridden. The rest of the app (buttons, links, pagination) keeps the global ring, so focus
  styling is also inconsistent. WCAG 2.2 SC 2.4.7.
- **Recommendation:** Replace `focus:outline-none` with `focus-visible:outline-2
  focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2` in `CONTROL`, or simply
  drop `focus:outline-none` and let the global rule apply. Same edit in the two bespoke inputs.
- **Effort:** S — under an hour.
- **Impact:** Consistent, visible focus across every interactive element.

---

**H-8 · No continuous integration**

- **Affected:** repository root — no `.github/`, no CI configuration of any kind
- **Evidence:** `ls -a .github` → does not exist. `package.json` has `lint`, `test`, `typecheck`,
  `test:e2e` and `build` scripts, all of which pass locally; nothing runs them automatically. No
  Prettier config, no `format` script, no Husky, no lint-staged.
- **Explanation:** The quality bar in this repository is high and entirely unenforced. The Playwright
  suite in particular has already proven its value — it caught a runtime-only missing-message error
  that Jest could not see — and it will decay the first time someone skips it.
- **Recommendation:** One workflow: `npm ci` → `typecheck` → `lint` → `test` → `build` →
  `test:e2e` on pull requests. Add Prettier with a `format:check` step. Optionally a Jest coverage
  threshold once a baseline is measured.
- **Effort:** S — half a day.
- **Impact:** Locks in everything else this audit recommends.

---

### MEDIUM

---

**M-1 · No `loading.tsx` at any route segment**

Absence across `src/app/**`. Navigation renders an empty `<main>` until the client component mounts
and its first query resolves; only then does `TableSkeleton` appear. A per-group `loading.tsx`
reusing the existing `TableSkeleton` gives an instant paint. **Effort:** S. **Impact:** perceived
performance on every navigation.

---

**M-2 · Virtualization is dead code and its rendering path is likely broken**

`virtualize` is offered by `DataTable` (line 55) and used by zero application files — only by
`data-table.test.tsx`. `@tanstack/react-virtual` is imported unconditionally, so it ships in every
bundle containing a table. Worse, the virtual path renders rows as `position: absolute; display:
flex` with `flex-1` cells while the `<thead>` remains a normal table row, so header and body columns
cannot align. It also triggers a React Compiler bailout (see L-3). Since Round 2 made every primary
table paginate at 10 rows, no table can be long enough to need it.
**Recommendation:** Remove the prop, the import and the dependency; if a genuinely unpaginated long
table appears later, reintroduce it with a matching virtualized header. **Effort:** S.
**Impact:** smaller bundles, one fewer untested code path, one fewer compiler bailout.

---

**M-3 · Every table row is rendered twice into the DOM**

`DataTable` renders a `<table>` under `hidden md:block` *and* a `<ul>` of cards under `md:hidden`,
both from `pageRows`. Correct for accessibility (the hidden branch is `display:none`, so it stays out
of the a11y tree) but it doubles React elements, cell function calls and DOM nodes on every render.
At 10 rows × 6 columns this is 120 cell renders instead of 60. **Recommendation:** acceptable as-is;
if it ever shows in a profile, gate on a `useMediaQuery`. Documented so it is a known trade-off
rather than an oversight. **Effort:** S if addressed. **Impact:** low today.

---

**M-4 · No column sorting anywhere**

`grep -rn "sortable\|onSort\|sortBy" src/` returns nothing across 19 tables. Filtering and search are
well covered; ordering is fixed by the API. For an operations back office this is a routine
expectation (sort by amount, by date, by status). **Recommendation:** add an optional `sortable` flag
to `Column<T>` with an `aria-sort` header button; pair with C-3 so sorting is server-side where the
dataset is truncated. **Effort:** M. **Impact:** meaningful daily-use improvement.

---

**M-5 · Clickable rows use `<tr>` with `tabIndex` rather than a control**

`DataTable` puts `onClick`, `onKeyDown`, `tabIndex={0}` and `aria-label` on the `<tr>`. Enter and
Space are handled, which is more than most implementations do, but the element still exposes
`role="row"` while behaving as a button, and the row's `aria-label` replaces the cell content for
screen readers rather than supplementing it. The mobile card branch gets this right with an explicit
`<button>` (the "expand row" action). **Recommendation:** mirror the mobile approach — a dedicated
button in a trailing cell — or keep the row click as a mouse convenience and drop `tabIndex`/
`aria-label` from the `<tr>`. **Effort:** S. **Impact:** cleaner semantics on 12 detail-drawer tables.

---

**M-6 · Global search places the query in a URL parameter**

[src/components/layout/app-shell.tsx:40](../../src/components/layout/app-shell.tsx#L40) navigates to
`/core/analytics/all-operations?q=<term>`. The specification requires no sensitive data in query
strings. A search term in this app is frequently a client name, an account number or a reference.
Query strings persist in browser history, appear in `Referer` on outbound navigation, and are the
most commonly logged part of a URL. The middleware's own comment shows the team already knows this
rule. **Recommendation:** either navigate without the parameter and hand the term over via a store,
or accept it with an explicit written justification and ensure the deployment does not log query
strings. **Effort:** S. **Impact:** removes an inconsistency with the project's own stated rule.

---

**M-7 · Deprecated `middleware` file convention**

Every `next build` prints: `⚠ "middleware" file convention deprecated. Please use "proxy" instead.`
The codemod is `npx @next/codemod@canary middleware-to-proxy .`. This was deliberately deferred in
Round 2 because it touches the auth guard. **Recommendation:** run the codemod as its own commit,
with the E2E auth-redirect specs as the gate. **Effort:** S. **Impact:** removes the build warning
and avoids a forced migration later.

---

**M-8 · Every route renders dynamically**

All 37 routes are marked `ƒ (Dynamic)` in the build output because the root layout reads cookies for
theme and locale. This is a *correct* trade for this app — server-rendering `data-theme` is what
eliminates the theme flash, and the panel is behind auth, so caching a static shell buys little.
Recorded as a known consequence rather than a defect: it means no route can be edge-cached or served
from a CDN as static HTML, which constrains future hosting choices. **Effort:** n/a.

---

**M-9 · Test coverage is narrow and ungated**

11 Jest suites / 51 tests plus 32 Playwright tests, all passing. Coverage collection is configured
(`collectCoverageFrom` covers `src/lib` and `src/components`) but no threshold is set and no report
is produced in any pipeline. Untested by unit tests: `src/lib/api/client.ts` (including the CSRF
header logic), `src/middleware.ts` (the auth guard), `src/lib/permissions.ts` (`can()`),
`src/lib/nav.ts`, `theme-provider`. The E2E suite is the stronger asset — `e2e/pages.spec.ts`
watches the console and catches runtime-only failures that jsdom cannot.
**Recommendation:** add unit tests for `can()`, `csrfHeader()` and the middleware matcher (all pure,
all cheap), then set a coverage floor at the measured baseline and ratchet. **Effort:** M.
**Impact:** protects the two files where a silent regression is most dangerous.

---

**M-10 · Four placeholder routes are live in the navigation**

`ComingSoon` renders at `/ubs`, `/cbl/contracts`, `/cbl/exchange-rates` and `/cbl/purchase-requests`.
Deliberate (`NavGroup` has a documented `phase2` flag), and keeping the IA stable is a defensible
choice — but four dead ends in a production panel invite support tickets. **Recommendation:** before
launch, either hide `phase2` groups behind a flag or make the placeholder explicitly say "planned",
with a target. **Effort:** S. **Impact:** user trust.

---

**M-11 · Chart data crosses a `as unknown as` boundary in six places**

`branch-cash-flow:158`, `all-operations:230` and `:267`, `reports:86`, `activity:125`,
`dashboard:452` all cast typed row arrays to `Record<string, unknown>[]` because the chart components
accept that type. These are the only unsafe casts in the repository — `grep` for `: any` and
`as any` returns nothing at all, which is excellent for 14.6k lines. **Recommendation:** make the
chart components generic (`<T extends Record<string, unknown>>` with `dataKey: keyof T & string`),
removing all six casts and gaining key-name checking. **Effort:** S. **Impact:** eliminates the
repository's only type-safety escape hatches.

---

**M-12 · The fixture login writes a cookie with the production session name**

[src/app/[locale]/(auth)/login/page.tsx](../../src/app/[locale]/(auth)/login/page.tsx) sets
`document.cookie = "saraf_session=fixture; path=/; samesite=lax"` from client JavaScript, guarded by
`if (usingFixtures)`. Verified: the guard is a build-time constant and the whole path is tree-shaken
out of a `NEXT_PUBLIC_API_MODE=live` build. The residual risk is naming: the stand-in uses the same
cookie name the middleware checks (`AUTH_COOKIE_NAME` defaults to `saraf_session`), so a
misconfigured environment where the flag is set makes a non-httpOnly, client-written cookie
sufficient to pass the route guard. **Recommendation:** name it `saraf_session_fixture` and have the
middleware accept it only when `NEXT_PUBLIC_API_MODE === "fixtures"`. Also add `Secure` for
completeness. **Effort:** S. **Impact:** removes a configuration-error footgun; documented in the
README already, which is why this is Medium and not High.

---

**M-13 · No `robots` directive and only static metadata**

[src/app/[locale]/layout.tsx:21](../../src/app/[locale]/layout.tsx#L21) exports a static
`{ title: "Saraf", description: … }`. No route exports `generateMetadata`, so every one of 37 pages
shares one browser-tab title — a real usability cost when an operator keeps six tabs open. And an
internal admin panel should carry `robots: { index: false, follow: false }`.
**Recommendation:** add `robots` to the root metadata, and a per-route `generateMetadata` returning
the page title from the same message catalogue the `PageHeader` already uses. **Effort:** S.
**Impact:** usable tab titles; no accidental indexing if the panel is ever reachable.

---

### LOW

| ID | Finding | Evidence | Fix | Effort |
| --- | --- | --- | --- | --- |
| L-1 | Unused variable | `countries/page.tsx:30` — `'tf' is assigned a value but never used` | Delete the line | XS |
| L-2 | Badge counts bypass locale formatting | `app-shell.tsx:165` and `sidebar.tsx:100` render `{count}` raw; the rest of the app uses `formatCount` | Wrap in `formatCount` | XS |
| L-3 | Five React Compiler bailouts | `next lint` reports "Compilation Skipped: Use of incompatible library" at `data-table.tsx:152` (`useVirtualizer`) and in `users/page.tsx:265`, `dual-party-form.tsx:104`, `external-transfer-form.tsx:101`, `single-workflow-form.tsx:92` (React Hook Form) | Removing virtualization (M-2) clears one; the RHF ones are upstream — awareness only | XS |
| L-4 | Strict-mode gaps in `tsconfig.json` | `strict: true` but no `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` or `noImplicitOverride`. Relied on by `pageSizeOptions[0]` and `item.icon!` (`app-shell.tsx:149`) | Enable `noUncheckedIndexedAccess` and fix the fallout | S |
| L-5 | No formatter | No Prettier config, no `format` script, no editor config beyond `.vscode` | Add Prettier + a CI check | XS |
| L-6 | Empty `public/` | Directory exists with no files; `favicon.ico` sits in `src/app/` (which is correct for App Router). No `apple-touch-icon`, no web manifest | Add if the panel is ever installed to a home screen | XS |
| L-7 | Largest file is 603 lines | `dashboard/page.tsx` holds six local components | Extract `TrendsCard`, `TrendTable`, `TrendRangeSelector` to siblings if it grows further | S |
| L-8 | Three identical ar/en values | `common.notAvailable`, `nav.ceft`, `fields.iban` | **Verified correct** — a dash and two acronyms. No action | — |

---

## 4. Documentation Audit

### Exists

| Document | Assessment |
| --- | --- |
| `README.md` (128 lines) | **Genuinely good.** Getting started, an environment variable table with a "where" column, an explicit fixtures-mode explanation including the login caveat, the brand token table with the two documented AA deviations, the `<Logo>` contract, the table pagination rules with their rationale, testing instructions, and an honest "Open Items" section. Better than most internal READMEs. |
| `AGENTS.md` / `CLAUDE.md` | Tooling notes, auto-generated. Not project documentation. |
| Inline comments | **The strongest documentation in the repository.** They consistently explain *why*: "Charts are decorative here; the paired table carries the same data", "the `+` is added at render, never stored (that produced the `++216` double prefix)", "Session lives in an httpOnly cookie set by the backend — never localStorage", "Adjusted during render rather than in an effect". This is the habit that makes the codebase maintainable. |
| `.env.example` | Complete, with the server-only variable marked. |

### Missing

1. **Architecture overview** — no document explains the layering (`app/` → `components/{ui,shared,modules,forms}` → `lib/{api,…}`), or why every page is a client component. A new contributor infers it from reading.
2. **Deployment guide** — no runbook. Which host, which env vars at build vs runtime, how HTTPS terminates, what the CSP will be, how the session cookie domain is configured. This gap blocks a first deploy.
3. **Component / design-system reference** — 7 `ui/` primitives and 15 `shared/` components with no catalogue. Prop-level doc comments exist but nothing aggregates them.
4. **Accessibility statement** — a WCAG 2.2 AA conformance claim needs a documented basis, especially given the four defects above.
5. **API contract reference** — `src/lib/api/endpoints.ts` and `types.ts` *are* the contract; nothing states which backend version they target or how a mismatch surfaces.
6. **ADRs** — several non-obvious decisions have no record beyond a code comment: native `<dialog>` over a headless library, fixtures mode as a first-class API mode, client-side export instead of a backend endpoint, `localePrefix: "as-needed"` with Arabic unprefixed.
7. **`CONTRIBUTING.md`** — no branch, commit, review or test-before-push convention.
8. **Security notes** — the ASVS-aligned controls (CSRF, masking, audit-on-reveal, CSV escaping, write-only secret) are implemented and commented but never listed anywhere an auditor would look.

### Recommended (priority order)

1. `docs/DEPLOYMENT.md` — blocks the first production deploy.
2. `docs/ARCHITECTURE.md` — one page, one diagram, the layering rules.
3. `docs/SECURITY.md` — the control inventory, with the ASVS reference per control.
4. `docs/adr/` — start with the four decisions listed above, retroactively.
5. `CONTRIBUTING.md`.
6. A component catalogue (Storybook is likely overkill here; a single MDX page listing each primitive with its props would do).

---

## 5. Code Quality Metrics

| Metric | Measurement | Assessment |
| --- | --- | --- |
| Size | 106 `.ts`/`.tsx` files, 14,663 LOC | Proportionate to 37 routes |
| Largest file | 603 lines (`dashboard/page.tsx`) | Acceptable; six cohesive local components |
| Files over 400 lines | 6 (dashboard, fixtures/index, hooks, fixtures/data, data-table, approval-queue) | Two are fixture data; none is a god object |
| Component reuse | `DataTable` ×19, `PageHeader` ×29, `HeaderStatBar` ×16, `DetailDrawer` ×12, `ConfirmDialog` ×8, `FormWizard` ×3 | **Excellent** — the design system is used, not bypassed |
| Duplication | Three module abstractions (`approval-queue`, `simple-operation-list`, `transfer-list`) each cover two routes; the six analytics/report pages share chart primitives | Low. The one repeated shape is the page scaffold (`PageHeader` + `HeaderStatBar` + filters + `DataTable`), which is composition, not duplication |
| Architecture consistency | Every page follows the same import order, hook order and layout composition | **High** |
| Design-system consistency | One token file, one `cn()` helper, `clsx` + `tailwind-merge`, zero inline hex colours outside `globals.css` and the chart series constants | **High** |
| Type safety | `strict: true`; zero `any`; zero `@ts-ignore`; one `eslint-disable` (justified, `no-img-element` for a `data:` URI preview); six `as unknown as` casts, all at the chart boundary | **High** |
| Magic values | Fetch caps (100/200/500) hardcoded at 8 call sites; `rowHeight = 52`; `staleTime: 30_000` | The fetch caps are the only ones that matter — see C-3 |
| Code smells | Zero `TODO`, zero `FIXME`, zero `HACK`, zero `console.*` in `src/` and `e2e/` | **Exceptional** — this is rare |
| Dead code | `virtualize` + `@tanstack/react-virtual` (M-2); the `N` logo variants, documented as intentionally unreferenced | Minimal |
| Lint | 0 errors, 6 warnings (1 unused var, 5 compiler bailouts) | Clean |
| Test quality | Tests assert on user-visible behaviour via roles and labels, not implementation. Identity-based assertions (`firstRowText()`) rather than row counts — a deliberate fix for a real false-negative | **High quality, insufficient quantity** |
| Maintainability index (qualitative) | **8.5/10** | Held back only by architectural coupling to client-side rendering, not by code hygiene |

---

## 6. Standards Compliance Matrix

**Fully Compliant** = evidence found for every applicable requirement checked ·
**Partially Compliant** = substantial implementation with identified gaps ·
**Needs Improvement** = the control is largely absent ·
**Not Applicable** = out of scope for a front end

### ISO/IEC 25010 — Product Quality

| Characteristic | Status | Evidence |
| --- | --- | --- |
| Functional suitability | Partially Compliant | 33 of 37 routes functionally complete; 4 `ComingSoon` placeholders (M-10); result-set truncation is a functional-correctness defect (C-3) |
| Performance efficiency | Needs Improvement | 2.1 MB client chunks, 404 KB recharts chunk on all routes, no code splitting, no streaming (H-6) |
| Compatibility | Fully Compliant | Standard Next.js/React runtime; Playwright covers Desktop Chrome and Pixel 7 |
| Usability | Partially Compliant | Strong: RTL/LTR, mobile card fallbacks, confirm gates, empty/error states, 450-key i18n with zero drift. Gaps: no skip link (H-5), unnamed dialogs (H-3), unlinked errors (H-2), no sorting (M-4) |
| Reliability | Needs Improvement | No error boundary at any level (C-1); query-level retry policy is well designed (`retry` skips <500 responses) but does not cover render failures |
| Security | Partially Compliant | See ASVS row below |
| Maintainability | Fully Compliant | See §5 |
| Portability | Fully Compliant | All configuration via environment variables, fails loudly when absent (`src/lib/env.ts`) |

### ISO/IEC 25023 — Quality Measurement

**Partially Applicable.** Measures that can be evidenced today: test pass rate (51/51 unit,
32/32 E2E, 100%), build success rate (100%), lint error density (0 errors / 14,663 LOC), type
coverage (`strict`, zero `any`). Measures that cannot: mean time to failure, availability, defect
density in production — no telemetry, no error reporting, no analytics exist in the front end. If
25023 reporting is required, an error-reporting integration is the prerequisite.

### ISO/IEC 27034 — Application Security

**Partially Compliant.** Application Security Controls that are present and evidenced: environment
isolation of configuration, httpOnly session handling, CSRF double-submit, output-encoding by
default (no `dangerouslySetInnerHTML`), input validation at every form boundary (zod + RHF), data
masking with audit logging (`MaskedField`), write-only secret handling (`SecretField`), CSV injection
neutralization. Absent: a documented control inventory, a defined verification process (no CI), CSP
as a containment control, and route-level authorization. The controls exist; the *organizational
process* around them, which is what 27034 actually governs, does not.

### OWASP ASVS (frontend-applicable subset)

| Chapter | Status | Evidence |
| --- | --- | --- |
| V1 Architecture | Partially Compliant | Clear layering and a documented threat posture in comments; no written security architecture doc |
| V2 Authentication | Fully Compliant | httpOnly cookie only, no client token storage, `autoComplete="current-password"`, no credential logging, no plaintext password display in the admin UI |
| V3 Session Management | Fully Compliant (frontend portion) | Session is entirely backend-owned; the front end never reads, writes or persists it — except the fixtures stand-in (M-12) |
| V4 Access Control | **Needs Improvement** | Navigation-level filtering only; no route or action-level enforcement (C-2) |
| V5 Validation & Encoding | Fully Compliant | zod schemas on every form, React auto-escaping, zero `dangerouslySetInnerHTML`, CSV escaping in `export.ts` |
| V7 Error Handling & Logging | Partially Compliant | Errors surface generically without leaking internals (good); no error boundary and no client error reporting (C-1) |
| V8 Data Protection | Partially Compliant | Mask-by-default with reveal audit logging; secret never re-displayed; no sensitive data in `localStorage`. Gap: search terms in query strings (M-6) |
| V12 Secure Communication | Partially Compliant | `credentials: "include"` over the configured base URL; no HSTS declared (H-1) |
| V14 Configuration | Partially Compliant | 4 security headers set, `poweredByHeader: false`, env-var enforcement; no CSP (H-1) |

### OWASP Top 10 (2021)

| Risk | Status |
| --- | --- |
| A01 Broken Access Control | **Needs Improvement** — C-2 |
| A02 Cryptographic Failures | Not Applicable (frontend holds no keys; nothing is encrypted client-side by design) |
| A03 Injection | Fully Compliant — React escaping, zod validation, CSV escaping |
| A04 Insecure Design | Partially Compliant — confirm gates, typed confirmation for destructive actions, masking; truncated result sets are a design flaw (C-3) |
| A05 Security Misconfiguration | **Needs Improvement** — no CSP, no HSTS (H-1) |
| A06 Vulnerable Components | Partially Compliant — dependencies are current (Next 16.3, React 19.2, TanStack Query 5); no automated vulnerability scanning (no CI) |
| A07 Identification & Authentication Failures | Fully Compliant (frontend portion) |
| A08 Software & Data Integrity | Partially Compliant — no SRI needed (no external scripts), but no dependency pinning policy and no lockfile-integrity check in CI |
| A09 Logging & Monitoring Failures | **Needs Improvement** — `src/lib/audit.ts` fires UI audit events for sensitive reveals (good), but there is no client error reporting at all |
| A10 SSRF | Not Applicable |

### WCAG 2.2 Level AA

| Criterion | Status | Evidence |
| --- | --- | --- |
| 1.3.1 Info and Relationships | Partially Compliant | `<caption>`, `scope="col"`, `<dl>` on mobile cards — but field errors are not associated (H-2) |
| 1.4.3 Contrast (Minimum) | Fully Compliant | Tokens chosen for AA in both themes, with the two deviations documented in `globals.css` and the README |
| 1.4.11 Non-text Contrast | Partially Compliant | Border and icon tokens meet 3:1; the focus indicator on inputs is a border-colour change only (H-7) |
| 2.1.1 Keyboard | Fully Compliant | Rows respond to Enter/Space; all controls are native elements |
| 2.1.2 No Keyboard Trap | Partially Compliant | Native `<dialog>` is correct; the mobile drawer lets focus escape behind the overlay (H-4) |
| **2.4.1 Bypass Blocks (Level A)** | **Needs Improvement** | No skip link (H-5) — the only Level A failure found |
| 2.4.3 Focus Order | Partially Compliant | Correct except the mobile drawer (H-4) |
| 2.4.7 Focus Visible | **Needs Improvement** | Suppressed on all form controls (H-7) |
| 2.4.11 Focus Not Obscured | Fully Compliant | Sticky header is `z-30`; the modal is a native top-layer `<dialog>` |
| 3.2.3 Consistent Navigation | Fully Compliant | One `AppShell`, one `SidebarNav`, `aria-current="page"` throughout |
| 3.3.1 Error Identification | Partially Compliant | Errors are visible and `role="alert"`, but not programmatically linked (H-2) |
| 3.3.2 Labels or Instructions | Fully Compliant | Every control routes through `Field` with a real `<label htmlFor>`; the one bare `<select>` carries `aria-label` |
| 4.1.2 Name, Role, Value | Partially Compliant | `aria-pressed`, `aria-expanded`, `aria-current`, `role="radio"`/`radiogroup` used correctly — but dialogs have no accessible name (H-3) |
| 4.1.3 Status Messages | Partially Compliant | `role="status"` / `aria-live` in 3 places; table loading, pagination changes and mutation results announce nothing |

**Honest conclusion:** the app is **close to** WCAG 2.2 AA, not at it. Four fixes (H-2, H-3, H-4,
H-5) plus H-7 would move nearly every "Partially Compliant" row to compliant, and all five are
small.

### ISO/IEC 42001 — AI Management

**Not Applicable.** The repository contains no AI or machine-learning functionality: no model calls,
no inference, no AI-assisted feature. The only AI-adjacent artifacts are developer tooling files
(`AGENTS.md`, `.claude/`, `.mcp.json`), which are not part of the product. Forcing this standard here
would be exactly the kind of misapplied compliance the audit brief warned against.

---

## 7. Refactoring Roadmap

### Phase 1 — Critical Production Issues (est. 1 week)

| # | Work | Finding | Effort |
| --- | --- | --- | --- |
| 1 | `error.tsx` per segment + `global-error.tsx` | C-1 | S |
| 2 | Truncation notice on capped tables (interim), then controlled server pagination in `DataTable` | C-3 | S then L |
| 3 | `usePermission` + `<RequirePermission>` on all 37 routes; gate destructive actions | C-2 | M |
| 4 | CSP (report-only → enforce) and HSTS | H-1 | M |
| 5 | CI workflow: typecheck → lint → test → build → e2e | H-8 | S |

**Rationale:** every item here is a thing that either loses data from the operator's view, leaves
them stranded with no recovery, or lets a defect ship unnoticed. Item 5 is listed last but should be
done first — it is what keeps items 1–4 from regressing.

**Expected impact:** the application becomes deployable. Blank-screen failures become recoverable
errors, result sets become trustworthy, unauthorized navigation produces a correct 403, and an XSS
would be contained rather than free.

### Phase 2 — High-Impact Improvements (est. 1 week)

| # | Work | Finding | Effort |
| --- | --- | --- | --- |
| 6 | `aria-describedby` for errors and hints in `Field` | H-2 | S |
| 7 | `useId`-based `aria-labelledby` in `Dialog` | H-3 | S |
| 8 | Rebuild the mobile drawer on `Dialog variant="sheet"` | H-4 | S |
| 9 | Skip link + `id="main"` | H-5 | S |
| 10 | Restore the focus ring on form controls | H-7 | S |
| 11 | `next/dynamic` around `src/components/charts` | H-6a | S |
| 12 | `loading.tsx` per route group | M-1 | S |
| 13 | Remove `virtualize` and `@tanstack/react-virtual` | M-2 | S |
| 14 | `robots: { index: false }` + per-route `generateMetadata` | M-13 | S |

**Rationale:** ten small, independent, individually testable edits. Five of them clear WCAG rows;
three cut bundle size or perceived latency. Nothing here requires an architectural decision, which is
exactly why it should follow Phase 1 immediately rather than being deferred.

**Expected impact:** WCAG 2.2 AA becomes a defensible claim; the largest chunk leaves the critical
path for most routes; navigation paints instantly.

### Phase 3 — Architecture Refinements (est. 2–3 weeks)

| # | Work | Finding | Effort |
| --- | --- | --- | --- |
| 15 | Finish server-side pagination across all high-volume tables | C-3 | L |
| 16 | Column sorting in `DataTable`, server-backed where paginated | M-4 | M |
| 17 | Generic chart components; delete the six `as unknown as` casts | M-11 | S |
| 18 | `middleware` → `proxy` codemod, gated by the E2E auth specs | M-7 | S |
| 19 | Rename the fixture session cookie; scope it to fixtures mode | M-12 | S |
| 20 | Move page shells to Server Components where a client island suffices | H-6c | L |
| 21 | Unit tests for `can()`, `csrfHeader()`, the middleware matcher; coverage floor | M-9 | M |
| 22 | Search term out of the query string | M-6 | S |

**Rationale:** these change contracts (the table API, the chart API, the routing convention), so they
need the CI and the boundary work from Phases 1–2 underneath them. Item 20 is genuinely optional —
recommended only if page-load latency becomes a complaint.

**Expected impact:** the data layer stops being the scalability ceiling; the table gains the last
capability operators expect; the type system covers the final six escape hatches.

### Phase 4 — Developer Experience & Documentation (est. 1 week)

| # | Work | Finding | Effort |
| --- | --- | --- | --- |
| 23 | `docs/DEPLOYMENT.md` | §4 | S |
| 24 | `docs/ARCHITECTURE.md` | §4 | S |
| 25 | `docs/SECURITY.md` — control inventory with ASVS references | §4 | S |
| 26 | `docs/adr/` — the four retroactive decisions | §4 | S |
| 27 | Prettier + `format:check` in CI; consider lint-staged | L-5 | S |
| 28 | `noUncheckedIndexedAccess` in `tsconfig.json` | L-4 | S |
| 29 | Component catalogue for `ui/` and `shared/` | §4 | M |
| 30 | Resolve the four `ComingSoon` routes (ship, hide, or date them) | M-10 | S |

**Rationale:** everything here protects the work of the first three phases from erosion once a second
contributor joins. It is last because none of it changes what a user experiences — but the absence of
items 23–26 is what makes this repository dependent on its original author.

**Expected impact:** a new contributor can deploy, extend and review without archaeology.

---

## 8. Final Verdict

### Is this project production-ready?

**No — but it is close, and the distance is measured in days.** Five things stand between this
repository and a defensible production deployment: no error boundary (C-1), no route-level
authorization (C-2), silent result-set truncation (C-3), no CSP (H-1), and no CI (H-8). Phase 1
addresses all five in roughly a week. Nothing in that list requires rearchitecting anything; they are
missing pieces, not wrong pieces. What is already in place — env-var enforcement that fails the boot,
httpOnly-only session handling, CSRF headers, CSV-injection escaping, mask-and-audit on sensitive
fields, a write-only secret field — is the part that is usually missing and expensive to retrofit.

### Is the architecture scalable?

**For code, yes. For data, not yet.** Adding a route means composing four existing components and
adding one hook; the permission list, nav tree, query-key namespace and label domains are each a
single source of truth. That will hold at three times the current surface. The data layer will not:
every list route fetches a fixed slab of 100–500 rows and paginates it in the browser, so the product
has a hard ceiling somewhere around a few hundred records per view — past which the UI is not slow,
it is **wrong**. The `Paged<T>` contract to fix it already exists and is simply not wired through.

### Is the codebase maintainable?

**Yes, clearly.** Zero `TODO`, zero `FIXME`, zero `console.*`, zero `any`, one justified
`eslint-disable`, 0 lint errors, a clean `tsc --noEmit`, 450 i18n keys with zero drift between
languages, and comments that consistently explain *why* rather than *what*. Component reuse is real:
`DataTable` in 19 modules, `PageHeader` in 29. The one structural weakness is documentation — outside
an excellent README, the reasoning lives in one developer's head, and there are no ADRs, no
deployment runbook and no architecture note.

### Can new features be built safely on top of it?

**Yes, with two caveats.** The composition patterns are consistent enough that a new register or
approval screen is a day's work with high confidence. The caveats: (1) until CI exists, nothing
catches a regression — the excellent Playwright suite runs only when someone remembers; (2) until
`DataTable` supports server pagination, every new list screen inherits the truncation defect, so each
feature added before Phase 3 adds to the debt rather than to the product. Build features on this
codebase *after* Phase 1, not before.

### Top five priorities before further development

1. **Add error boundaries** (`error.tsx`, `global-error.tsx`) — a render throw currently white-screens
   an operator mid-transaction, with no recovery and no signal about whether the action committed.
2. **Set up CI** (typecheck, lint, test, build, e2e on every PR) — the quality bar here is high and
   entirely unenforced; this is the cheapest item on the list and it protects all the others.
3. **Enforce permissions at the route level** — `PERMISSION_MODULES` and `can()` already exist and are
   used in exactly one place; a `<RequirePermission>` wrapper turns a generic error into a correct
   403 and stops rendering actions users cannot perform.
4. **Fix table truncation** — ship the visible truncation notice this week, then wire the existing
   `Paged<T>` contract through `DataTable`; a financial back office cannot tell an operator that a
   transaction does not exist when it does.
5. **Add a Content-Security-Policy** — React's escaping is the only XSS defence in place today; CSP is
   what contains the one that eventually gets through, and what stops a compromised dependency from
   exfiltrating account data.

Two accessibility fixes (H-2 and H-5) are small enough to ride along with any of the above and should
not wait for Phase 2: they are a two-hour edit each and between them clear the audit's only Level A
failure and its most widespread AA failure.

# Changelog

Notable changes to the Saraf admin panel. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project has not cut
a release yet, so everything below is unreleased.

## [Unreleased]

### Enterprise readiness sprint — 2026-08-07

**Added**

- Top clients answers a second question: `src/lib/concentration.ts` and the
  panel it feeds divide the ranked clients' balances by the same currency's
  total from `currency-balances`, so the page says not only who the largest
  clients are but how much of the book they hold — a list of large balances
  reads identically whether those clients are three per cent of the money on
  deposit or eighty, and only one of those is a liquidity question. A currency
  the balances endpoint does not cover is dropped rather than divided by an
  assumed total.
- `docs/ARCHITECTURE.md` gains the analytics map: one row per surface, the
  question it answers, and the data that is its own.
- A feedback layer: `<FeedbackProvider>` and `useNotifiedAction()`
  (`src/components/providers/feedback-provider.tsx`). Until now a mutation that
  failed did nothing visible — the spinner stopped, the dialog closed or stayed
  open, and silence looked exactly like success, which is the state most likely
  to be clicked through a second time. Success is transient and auto-dismisses;
  a failure persists and carries the quotable reference support asks for. The
  message is always one this application wrote: a backend error string can carry
  internals, is not translated, and is not something an operator can act on.
- `src/lib/text-safety.ts` — directional-override handling, both halves.
  `neutralizeBidi()` strips U+202A–U+202E and U+2066–U+2069 from values on their
  way to a screen or a workbook; `directionSafe` is a zod refinement that
  rejects them on the way in. A stored string carrying an override reorders what
  is rendered, which on an approval screen means the operator releasing funds
  reads a different name than the one the backend holds and the audit record
  keeps. LRM and RLM are deliberately kept — marks cannot reorder a run, and
  they occur in ordinary Arabic text.
- `e2e/security.spec.ts` — the security headers and the CSP, read off a served
  response rather than off the config file that claims to set them. Includes the
  two negatives that only a production build can prove: no `'unsafe-inline'` and
  no `'unsafe-eval'` in `script-src`.
- `npm run check:prod` — one production build serving both specs that need one.
- `scripts/check-secrets.mjs`, `scripts/bundle-report.mjs`, and the CI steps that
  run them. Secret scanning is the first gate in `quality`: it is the cheapest
  check and the only one whose failure means "rotate a key" rather than "fix the
  code".
- `docs/CI_CD.md` — what each gate proves, and the branch protection the
  pipeline is advisory without.

**Changed**

- Fixture `top-clients` rows denominate `balance` in `currency` — one currency's
  accounts rather than a sum across all of them. The old total added LYD to USD
  and labelled the result with whichever account came first, which the new share
  of the book would have divided by the wrong denominator. `docs/API_CONTRACT.md`
  now states the requirement the panel depends on.
- `<ConfirmDialog>` and `<FormWizard>` await their callback and surface a
  rejection where the operator is already looking, instead of swallowing it.
  Both signatures now allow a promise (`onConfirm(input) => void | Promise`,
  `onSubmit() => void | Promise`); a rejected one keeps the dialog or the wizard
  open with a reference rather than closing over a transfer that never happened.
- Every remaining save path — branches, users, clients, accounts, currencies,
  countries, operation rules, operations pricing, system info — goes through
  `useNotifiedAction()`, so each one confirms what it did and closes only when
  the write actually landed.
- CI builds with `build:release`, stamped with the commit and environment, so
  the footer and the diagnostics card do not report a CI artefact as
  `0.0.0-dev`.
- `docs/SECURITY.md` gains a validation sweep: twenty attack classes walked
  against the source in OWASP ASVS terms, each with a verdict and the evidence
  behind it, plus the commands a reviewer can re-run. The CSV formula-injection
  section was stale — there is no CSV export — and now describes why an `.xlsx`
  cell cannot carry a formula at all.

### Signed-out pages — 2026-08-06

**Added**

- `AuthShell` (`src/components/auth/auth-shell.tsx`) — one frame for every page
  reachable without a session. Sign-in and password reset now render in it, and
  any page added later inherits the layout rather than reproducing it.
- Language, theme and the accessibility centre are available **before** sign-in,
  from a toolbar in that shell. An operator who needs larger text or more
  contrast needs it to read the sign-in form, not after.
- `ThemeToggle` (`src/components/shared/theme-toggle.tsx`) — a standalone icon
  button for surfaces with no user menu. The menu keeps its own
  `menuitemcheckbox` row; the two are different controls, not one component
  rendering two ways.
- `useOptionalShortcutRegistry()`, so a component can ask whether a shortcut
  registry exists instead of throwing. The accessibility centre uses it to omit
  the keyboard-shortcut sheet on pages that register no chords.

**Changed**

- Password reset was a card on a plain background; it now matches sign-in
  exactly. Its behaviour is untouched — same schema, same uniform response
  whether or not the account exists, same challenge gating.
- `renderWithProviders` wraps tests in `ThemeProvider` and `A11yProvider`,
  mirroring the root layout, and takes `shortcuts: false` for components that
  render outside the app shell.

### Production hardening sprint — 2026-08-06

**Added**

- A JavaScript budget with a number behind it: `e2e/performance.spec.ts`
  measures per-route transferred JS on a production build, and
  `npm run perf:budget` builds, serves and runs it in one step. Ceilings are
  460 KB per route, 300 KB for the shared baseline, and a chart-route delta that
  proves recharts is still lazy. Documented in
  [docs/PERFORMANCE.md](docs/PERFORMANCE.md).
- Automated WCAG 2.2 AA scanning over **every** route, public and private
  (`e2e/a11y.spec.ts`, `npm run test:e2e:a11y`), with the Turnstile iframe
  excluded and the limits of mechanical testing stated rather than glossed —
  [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).
- A real XLSX writer (`src/lib/xlsx.ts`) — no spreadsheet dependency — and a
  print pipeline with a letterhead, so "Export PDF" produces a document that
  survives a printer.
- A day stepper on Reports: previous day, next day, and Today, over the existing
  single-date `/reports` contract.
- Documentation that did not exist and was already being referenced from source:
  [ARCHITECTURE](docs/ARCHITECTURE.md), [SECURITY](docs/SECURITY.md),
  [ACCESSIBILITY](docs/ACCESSIBILITY.md), [PERFORMANCE](docs/PERFORMANCE.md),
  [API_CONTRACT](docs/API_CONTRACT.md), [CONTRIBUTING](CONTRIBUTING.md), this
  file, and ADRs 0001–0005 with an [index](docs/adr/README.md).

**Changed**

- Every register now states how it pages at the call site. `<DataTable>` takes a
  required `paging` prop — a `ServerPaging` object, `"client"`, or `"none"` —
  replacing a mix of implicit strategies where the reader could not tell which
  applied ([ADR-0004](docs/adr/0004-table-pagination.md)).
- `data-table.tsx` split from 723 lines into three files: the table, the pager
  (`table-pager.tsx`), and the density preference (`table-density.tsx`).
- The nine-item **Settings** group in the sidebar became two groups with
  different jobs — **Configuration** (rules applied to money) and
  **Administration** (who may act, from where, and what they did) — placed after
  Reports and Analytics so the sidebar runs daily work → insight → setup.
- Direction is a CSS property everywhere rather than a branch, and the three
  things that genuinely do not mirror are named
  ([ADR-0002](docs/adr/0002-arabic-first-and-direction-by-property.md)).

**Fixed**

- Accessibility violations found by the new axe sweep, on the routes nobody had
  thought to check.
- Chart axis labels escaping the plot area in Arabic.
- Link prefetches being caught by the proxy's session check and 404-ing.

**Security**

- Per-request CSP with a fresh nonce and `'strict-dynamic'`, plus a narrow
  `style-src-attr` exception for chart heights rather than relaxing all styles.
- The full static header set: HSTS, `X-Frame-Options`, `Referrer-Policy`, a
  `Permissions-Policy` denylist, COOP, COEP and CORP.
- Redirect targets validated by `safeRedirect` — schemes, `//host`, `/\host` and
  C0 characters all refused on the one screen where an operator is about to type
  a password.
- CSV and XLSX exports neutralise formula injection.
- Documented in [docs/SECURITY.md](docs/SECURITY.md), including what the
  frontend cannot fix on its own.

### Initial build — 2026-08-05 to 2026-08-06

The panel itself: bilingual Arabic/English with Arabic as the default locale,
RTL-first, light and dark themes with no gradients, forty routes across
dashboard, clients, accounts, six operation types, approval queues, analytics,
reports, configuration and administration. Next.js App Router with TypeScript
strict, Tailwind, next-intl, React Hook Form with zod, TanStack Query, a typed
API client, and httpOnly-cookie authentication with proxy-level route guards.
Jest and React Testing Library for units, Playwright for flows, and an in-memory
fixtures backend that every test runs against.

---

Entries are written for someone deciding whether a change affects them, not as a
restatement of `git log`. If a change is invisible to an operator and to a
developer reading the code, it does not need a line here.

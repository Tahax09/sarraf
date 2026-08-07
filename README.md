# Saraf — Admin Panel (front end)

Bilingual (ar/en) RTL-first back-office panel for currency exchange and money
transfer. Front end only: every endpoint it calls is expected to exist on the
backend already.

## Getting started

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL is required — the app refuses to boot without it
npm install
npm run dev                  # http://localhost:3000
```

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | client + server | Base URL of the backend. No default, no fallback — a missing value fails at startup. |
| `NEXT_PUBLIC_API_MODE` | client + server | `fixtures` serves the in-memory dataset instead of calling the API. Anything else calls the real backend. |
| `NEXT_PUBLIC_APP_NAME` | client | Display name in the shell. |
| `AUTH_COOKIE_NAME` | server only | Name of the httpOnly session cookie the backend issues. Never prefix with `NEXT_PUBLIC_`. |

No secrets, keys or base URLs are hardcoded anywhere in `src/`.

### Fixtures mode

`NEXT_PUBLIC_API_MODE=fixtures` swaps the API client for `src/lib/api/fixtures`,
a mutable in-memory dataset (46 clients, 104 accounts, ~3.7k ledger rows, the
full money-movement set). Approvals, cancellations and registrations mutate that
state for the life of the process, so flows are demonstrable end to end.

**Login in fixtures mode accepts any non-empty username and password** — there
is no seeded credential list, because authentication belongs to the backend. On
success the page writes a non-httpOnly `saraf_session=fixture` cookie purely so
the route middleware has something to read; real sessions are httpOnly cookies
set by the backend and are never touched by client code.

## Brand

Three flat tokens live in `src/app/globals.css` and everything else is derived
from them — hover, disabled, muted and the dark-mode lifts are shades of these,
not new colors:

| Token | Value | Used for |
| --- | --- | --- |
| `--brand-blue` | `#0056F5` | primary accent: buttons, links, active state, focus ring |
| `--brand-green` | `#04BF66` | positive: deposits, approved, positive net flow |
| `--brand-dark` | `#1C1E1C` | dark-mode background base, primary text in light mode |

Two shades are deliberately not the raw brand color: `--color-success` in light
mode is darkened for AA contrast on white, and `--color-accent` in dark mode is
lifted for AA on the dark surface. No gradients anywhere.

`<Logo>` (`src/components/shared/logo.tsx`) is the only place a logo file is
named. It picks the asset from the current theme (light → colored or black,
dark → white), the layout direction (the horizontal lockup has an RTL and an
LTR cut) and an `orientation` prop (`horizontal` | `vertical`). Add a logo
somewhere new by rendering the component, never by importing a file.

## Tables

Every list view goes through `<DataTable>`. It takes a **required `paging`
prop** with three possible values, because how a register pages depends on the
endpoint behind it and that decision belongs in the diff rather than in a
default:

| Value | When | What the table does |
| --- | --- | --- |
| a `ServerPaging` object | the endpoint returns `Paged<T>` | renders the page it was given; the pager calls back for the next |
| `"client"` | the endpoint returns the whole array | slices in the browser and pages the slices |
| `"none"` | the set is bounded by the contract | renders every row, no pager |

Page sizes are 10 / 20 / 25 / 50, defaulting to 10, and the leading row-number
column keeps counting across pages (page 2 starts at 11). Which register uses
which value, and the three-line change each `"client"` register needs when its
endpoint starts paging, is [ADR-0004](docs/adr/0004-table-pagination.md).

From the `md` breakpoint up the table is real `<table>` markup; below it, the
same rows render as cards. The pager and the row-density preference live beside
the table in `table-pager.tsx` and `table-density.tsx`.

Raw translation keys must never reach the screen. `src/test/__tests__/i18n-keys.test.ts`
walks every `useTranslations` binding in `src/` and fails the build if a key is
missing from either catalogue, which is how a leaked `table.rowNumber` gets
caught before QA.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm run build` / `npm start` | Production build / serve. |
| `npm run typecheck` | `tsc --noEmit`, strict. |
| `npm run lint` | ESLint, including the React Compiler rules. |
| `npm test` | Jest + React Testing Library (unit + integration). |
| `npm run test:coverage` | Jest with the coverage thresholds enforced. |
| `npm run check:messages` | Fails if the `ar` and `en` catalogues disagree on a key or carry an empty value. |
| `npm run test:e2e` | Playwright, money-movement flows, desktop **and** phone. |
| `npm run test:e2e:a11y` | axe-core over every route, WCAG 2.1/2.2 AA tags. |
| `npm run perf:budget` | Production build + per-route JavaScript budget. |
| `npm run check:prod` | The same build, plus the CSP assertions that only hold on one. |

## Testing

- **Unit** — formatters (phone, IBAN, masking, short IDs), CSV export escaping,
  the enum label dictionary, `MaskedField`/`SecretField`, `ConfirmDialog`,
  `DataTable`.
- **Integration** — the register wizards (`SingleWorkflowForm`,
  `DualPartyForm`) and the approval queue, rendered against the fixtures API
  with the real message catalogue: a hardcoded string or a missing key fails the
  test rather than QA.
- **Page smoke** (`e2e/pages.spec.ts`) — the read-only pages loaded with the
  console watched: a message key that resolves in the catalogue but not in the
  running app, and a chart that throws on real data, only show up here.
- **E2E** (`e2e/`) — the six money-movement modules: withdrawal, deposit,
  authorized withdrawal (register + approve), external transfer (cancel with
  typed confirmation and mandatory reason), fund transfer, CEFT. Both a desktop
  and a Pixel-7 project run the same specs, since approvals happen on phones.
- **Accessibility** (`e2e/a11y.spec.ts`) — axe-core over every route in the app,
  at WCAG 2.1/2.2 AA tags. What that does and does not prove is
  [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).
- **Performance** (`e2e/performance.spec.ts`) — per-route JavaScript budget,
  measured in the browser on a production build. Skipped unless `E2E_PROD=1`;
  `npm run perf:budget` sets it up. Numbers in
  [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

Playwright reuses a dev server already listening on port 3000 and starts one
otherwise. Use `http://localhost`, not `127.0.0.1`: the Next dev server treats
the numeric host as cross-origin and refuses to serve its chunks.

## Documentation

| Document | What it answers |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | how the pieces fit and which layer owns what |
| [docs/SECURITY.md](docs/SECURITY.md) | what is defended, and what only the backend or the deployment can fix |
| [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | the AA target, what is verified automatically, and the known gaps |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | the JavaScript budget and how it is enforced |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | what this frontend assumes of the backend |
| [docs/adr/](docs/adr/README.md) | why the shape is the shape — the decisions and the rejected alternatives |
| [CONTRIBUTING.md](CONTRIBUTING.md) | the gates, the rules, and where code goes |
| [CHANGELOG.md](CHANGELOG.md) | what changed |

## Open items

Flagged rather than guessed:

1. **Currency page naming** — the type carries `alphabeticCode` / `numericCode`
   rather than a single `code`; confirm which the backend returns.
2. **Countries dial codes** — the register is now full CRUD (Arabic name,
   English name, ISO code, continent, dial code) and stores the dial code as
   digits, adding the `+` at render. Still open: whether the backend supplies a
   complete country list or expects this table to be maintained by hand, and
   whether the codes are reference data or live.
3. **Banking Services** — no specification was provided; not built.
4. **API contract** — the backend's OpenAPI document was never supplied, so
   [docs/API_CONTRACT.md](docs/API_CONTRACT.md) writes down what this frontend
   assumes, and `src/lib/api/endpoints.ts` and `src/lib/api/types.ts` are its
   machine-readable half. Its closing section lists the five questions still
   open with the backend team.
5. **Exports** — no export endpoint was specified, so CSV/PDF are produced
   client-side from what is already on screen (CSV with formula-injection
   neutralization; PDF via the browser's print pipeline and a print stylesheet,
   so no third-party bundle is added).

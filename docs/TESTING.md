# Testing

What is tested, at which level, and — the part that decides whether a suite is
worth its runtime — what each level is *for*.

The rule the whole suite follows: **a test exists to catch a regression a
reviewer would miss.** A test that restates the implementation catches nothing
and has to be rewritten every time the implementation changes, so it is worse
than no test. Where that means a module has fewer tests than its line count
suggests it should, that is a decision rather than an omission.

## The levels

| Level | Runner | What it certifies | Where |
| --- | --- | --- | --- |
| Unit | Jest + jsdom | Pure logic: money formatting, permission resolution, concentration maths, redirect validation, workbook writing, BiDi neutralisation. | `src/**/__tests__/` |
| Component | Jest + React Testing Library | Behaviour an operator can observe: what a dialog announces, what a failed save leaves on screen, what a table renders when the query errors. | `src/**/__tests__/` |
| End to end | Playwright | Journeys, and everything that only exists in a real browser: response headers, CSP, focus geometry, layout at twelve widths. | `e2e/` |
| Accessibility | Playwright + axe-core | Every route in both locales, plus one open dialog. Its own project so it runs once rather than per device. | `e2e/a11y.spec.ts` |
| Static | tsc, ESLint, custom scripts | Layering rules, message-catalogue parity, hard-coded secrets, bundle budget. | `scripts/` |

```bash
npm test                 # Jest, ~4s
npm run test:coverage    # the same with the coverage gate
npm run test:e2e         # Playwright, all projects
npm run test:e2e:a11y    # the axe sweep alone
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint, including the layering rules
npm run check:architecture  # no cycles, layers point one way
npm run check:messages   # ar/en catalogues agree, key for key
npm run check:secrets    # no credential-shaped literal in source
npm run bundle:report    # per-route first-load JavaScript
npm run check:prod       # bundle budget + production-only header assertions
```

## Unit and component tests

`renderWithProviders` (`src/test/utils.tsx`) is the only way components are
rendered. It mounts the real provider stack — messages, theme, accessibility
preferences, query client, feedback — because half the bugs worth catching live
in the interaction between a component and a provider, and a component rendered
bare cannot have them.

It renders **Arabic by default**. The primary locale is the one most likely to
break and the least likely to be checked by hand, so it is the default rather
than the special case. `message("some.key")` reads the real catalogue, so a
hard-coded string or a missing key fails the test rather than shipping.

What gets a test:

- **Anything that computes a number an operator will act on.** Balances,
  shares, fees, date ranges, page counts.
- **Anything with a security consequence.** Redirect validation, BiDi
  neutralisation, permission resolution, masking.
- **Every failure path that leaves something on screen.** A dialog that
  swallows an error, a wizard that clears the form on a rejected submit, and a
  save that closes the drawer as though it had worked are all silent in
  production and loud in a test.

What does not: presentational variants, prop pass-through, and anything whose
assertion is a copy of the JSX.

## End-to-end tests

Playwright runs three projects:

| Project | Device | Runs |
| --- | --- | --- |
| `a11y` | Desktop Chrome | `a11y.spec.ts` only |
| `desktop` | Desktop Chrome | everything except `a11y.spec.ts` |
| `mobile` | Pixel 7 | everything except `a11y.spec.ts` and `performance.spec.ts` |

The splits are deliberate. axe computes from the accessibility tree, so running
it on two devices would double the longest job in CI to certify identical
markup; the AA criteria that *do* change with the viewport — reflow and target
size — are asserted in `responsive.spec.ts` instead. The JavaScript budget is a
property of the build, not the viewport, so it runs once.

The specs, and the question each one answers:

| Spec | Question |
| --- | --- |
| `auth-pages.spec.ts` | Do the signed-out pages carry the language, theme and accessibility controls, and does a preference survive moving between them? |
| `pages.spec.ts` | Does every route render without a console error, and do its interactive surfaces — the trend range, the movement pager, the day stepper — change what is shown? |
| `register-flows.spec.ts` | Does each register complete and return to its list, and does it refuse the combinations that must not be allowed (a sender chosen as their own receiver)? |
| `approvals.spec.ts` | Does approving remove the row, does cancelling demand the word and a reason, and does the cancelled tab keep both? |
| `rtl.spec.ts` | Is the shell laid out right-to-left, do directional icons turn with it, and does every value resolve its own direction? |
| `responsive.spec.ts` | Horizontal overflow and target size, at twelve widths. |
| `a11y.spec.ts` | axe across every route in both locales, plus focus-not-obscured geometry. |
| `security.spec.ts` | Headers, CSP shape, nonce freshness, open-redirect refusal. |
| `performance.spec.ts` | First-load JavaScript against the budget. |

**Fixtures, not a live API.** `NEXT_PUBLIC_API_MODE=fixtures` makes the suite
deterministic and lets it run with no backend at all. The cost is that a fixture
can drift from the real contract, which is why
[API_CONTRACT.md](API_CONTRACT.md) states the assumptions in prose the backend
team can read and disagree with.

**Arabic substring matching.** `getByRole(name)` matches by substring, and
Arabic labels are frequently prefixes of one another. Pass `exact: true` when a
locator is ambiguous.

### Running against a production build

Some assertions only hold in a production build — the CSP has no `unsafe-eval`,
the bundle is minified, and the header set is complete:

```bash
npx next build
npx next start -p 3200
E2E_PORT=3200 E2E_PROD=1 npx playwright test
```

Without `E2E_PROD=1` the production-only assertions skip themselves rather than
failing against a dev server.

## Coverage

A ratchet, not a target.

| Scope | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Global | 57 | 50 | 50 | 57 |
| `./src/lib/` | 66 | 53 | 58 | 69 |

The thresholds sit just under what the suite actually covers, so the gate fails
when a change removes coverage and never fails for an unrelated reason. Today's
figures are ~65% statements globally and ~89% for `src/lib`. Raise the floor when
the real number moves; `npm run test:coverage` prints it.

`src/lib` carries the higher floor because it is the pure logic — money
formatting, permission resolution, workbook writing, redirect validation — where
an uncovered branch is a defect rather than an unrendered variant.

The threshold is keyed on the **directory**, not on `src/lib/**/*.ts`. Jest
applies a glob key to each matching file individually, so the glob spelling would
demand 69% of every one of the sixty-odd files under `src/lib` — including
fixture generators and thin browser wrappers — and the gate would have failed on
thirty-seven counts the day it was switched on.

## Static gates

These are tests in every sense that matters: they fail the build, and each one
exists because something already went wrong.

- **`check-architecture.mjs`** — three structural rules a reviewer cannot hold
  in their head. **No import cycles**, because a cycle makes module
  initialisation order load-bearing and fails with an `undefined` at module
  scope and no stack trace worth reading. **Layers point one way** — `lib` is
  framework-agnostic logic, `components` render it, `app` routes them — because
  a `lib` module that imports a component cannot be tested or reasoned about
  without a DOM. **No reaching into a sibling's private folder**, of which
  importing another module's `__tests__` is the case that actually happens.
- **`check-messages.mjs`** — the Arabic and English catalogues must agree key for
  key. A missing key renders as the key itself, which is the kind of defect that
  ships because the reviewer reads only one locale.
- **`check-secrets.mjs`** — no credential-shaped literal in source. The rule the
  panel is built to is that base URLs and keys come from the environment; this
  is what enforces it.
- **`perf-budget.mjs`** — first-load JavaScript against the budget in
  [PERFORMANCE.md](PERFORMANCE.md).

## What is not tested, and why

- **The backend.** Out of scope by construction — this repository is the front
  end, and the fixtures are a stand-in the contract document describes.
- **Assistive technology.** axe is a linter for the accessibility tree, not a
  screen-reader user. The manual script is in
  [ACCESSIBILITY.md](ACCESSIBILITY.md#manual-validation), and the gap is that
  nobody has run it.
- **Visual regression.** No screenshot suite. On a design system this small the
  false-positive rate of pixel diffing costs more review time than it saves; the
  layout properties that are objective — overflow, target size, focus geometry —
  are asserted numerically instead.
- **Load and soak.** A front end's load characteristics are the backend's plus
  the browser's, and neither is measurable here.

# Pipeline and branch protection

What runs, what it proves, and what has to be configured in GitHub for any of
it to matter. A pipeline nobody can merge past is a pipeline; a pipeline that
can be merged past is a suggestion.

## Workflows

| Workflow | Trigger | Jobs |
| --- | --- | --- |
| `ci.yml` | push to `main`, every PR, manual | `quality`, `e2e`, `a11y`, `performance`, `audit`, `lighthouse` |
| `codeql.yml` | push to `main`, PR to `main`, weekly (Mon 03:00 UTC) | `analyze` |

Concurrency is grouped per ref with `cancel-in-progress`: a second push makes
the first run's answer worthless, and paying for it teaches people to ignore
the queue.

Every job runs against fixtures (`NEXT_PUBLIC_API_MODE=fixtures`) and a
reserved, unroutable base URL (`https://api.example.invalid`). **CI never
contacts a backend**, so a red build is always about this repository.

## `quality` — the gate most changes meet

Steps run with `if: ${{ !cancelled() }}` so one push reports every failure
rather than the first.

| Step | What a failure means |
| --- | --- |
| Secret scan | Stop. A credential-shaped string is in a tracked file — rotate it before touching the code. |
| TypeScript | `tsc --noEmit`. The contract between modules is broken. |
| Architecture rules | An import cycle, a layering violation (`lib` → `components` → `app` is one-directional), or production code importing a `__tests__` module. |
| ESLint | `--max-warnings=0`. Zero is the number: the allowance that used to exist covered five React Compiler bail-outs that have since been fixed at the source. |
| Unit tests | `jest --coverage --ci`. Thresholds in `jest.config.ts` are a ratchet set just under what the suite covers today. |
| Production build | `build:release`, which stamps version, commit and environment. |
| Translation catalogues | `en` and `ar` disagree on a key. |
| Bundle report | Composition by weight, published as an artifact on every run. |

Artifacts: `coverage/` on failure, `bundle-report.json` always (30 days — the
value of a size table is comparison with last month's).

## `e2e`, `a11y`, `performance` — separate jobs on purpose

They could be steps in one job. They are not, because a broken transfer flow, an
accessibility regression and a 40 KB bundle increase are three different
failures with three different owners, and a red X that names which one saves
the reader a log dive.

- **`e2e`** — Playwright, `desktop` and `mobile` projects, Chromium only (both
  projects are Chrome-based). Report uploaded on failure.
- **`a11y`** — axe over every route in both locales, `npm run test:e2e:a11y`.
  What axe does and does not certify is stated in
  [ACCESSIBILITY.md](ACCESSIBILITY.md); roughly a third of WCAG AA is
  mechanically testable, and the rest is in the manual checklist.
- **`performance`** — `npm run check:prod`: builds once, serves the build, and
  runs the two specs whose assertions are only true of a production artefact.
  `performance.spec.ts` measures transferred JavaScript per route against the
  ceilings in [PERFORMANCE.md](PERFORMANCE.md); `security.spec.ts` reads the
  headers off a served response and asserts that `script-src` carries neither
  `'unsafe-inline'` nor `'unsafe-eval'` — a negative that a dev server, which
  relaxes the policy deliberately, cannot prove. The other seven assertions in
  that spec run in `e2e` too, where they are cheap.

## `audit` and `codeql`

`npm audit --audit-level=high` fails the build; moderate and low are printed
but do not block, because a transitive advisory with no upgrade path should not
stop a deploy that fixes something else. CodeQL runs the
`security-and-quality` suite and uploads SARIF to the Security tab. Its weekly
schedule exists so a query added after a merge still finds code nobody has
touched since.

## Required branch protection

Configure on `main` — *Settings → Branches → Add rule*. The pipeline above is
advisory until this is set.

**Require a pull request before merging**
- Required approvals: **1** (2 for changes under `src/lib/api/`, `src/proxy.ts`,
  or anything in `docs/adr/` — enforce with CODEOWNERS rather than by asking).
- Dismiss stale approvals when new commits are pushed: **on**. An approval is
  of a diff, not of a branch.
- Require review from Code Owners: **on**.

**Require status checks to pass before merging** — *require branches to be up
to date*: **on**. Required checks, by job name:

```
Types, lint, unit tests, build
Playwright (desktop + mobile)
Accessibility (axe, WCAG 2.2 AA)
Production build checks (budget, CSP)
Dependency audit
Analyze (javascript-typescript)
```

`Lighthouse CI` is deliberately **not** required: it measures a hosted run and
is the check most likely to fail for reasons that have nothing to do with the
diff. Read it, do not gate on it.

**Also on**
- Require conversation resolution before merging.
- Require signed commits.
- Require linear history — this repository rebases; a merge bubble makes
  `git log --oneline` stop being a changelog.
- Include administrators. A rule that the person most likely to be in a hurry
  can skip is not a rule.
- Restrict force pushes and deletions.
- **Secret scanning + push protection**: on, at the repository level. The local
  `check:secrets` gate runs earlier; this one catches what never reached CI.

## Deployment

This repository builds an artifact; it does not deploy one. What a deployment
must provide — the four CORS and cookie requirements the backend has to satisfy,
the headers that must not be stripped — is in [DEPLOYMENT.md](DEPLOYMENT.md).

## Running the gates locally

```bash
npm run check:secrets      # cheapest, run it first
npm run typecheck
npm run check:architecture
npm run lint -- --max-warnings=0
npm run check:messages
npm run test:coverage
npm run test:e2e           # needs a dev server, or E2E_PORT against a build
npm run test:e2e:a11y
npm run check:prod         # builds and serves on its own port
```

`check:prod` and `test:e2e` both want a port. If a dev server is already
running, point the suite at a production build instead:
`E2E_PORT=3200 npx playwright test`.

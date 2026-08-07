# Saraf Admin Panel — Enterprise readiness certification

**Date:** 2026-08-07 · **Commit:** `9418485` · **Scope:** the frontend only.
The backend, its APIs and its deployment are outside this repository and outside
every claim below.

This document records what was measured, what the measurement proves, and what
it does not. Every figure in it was produced by a command in this repository
against a production build, and every command is named so a reader can disagree
with the result rather than with the summary.

## How to reproduce every number here

```bash
npm ci
npm run typecheck                       # tsc --noEmit, strict
npm run lint -- --max-warnings=0
npm run check:messages                  # ar/en catalogue parity
npm run check:architecture              # cycles, layering, private folders
npm run check:secrets                   # credential-shaped literals
npm run test:coverage                   # jest + coverage gate
npm run check:prod                      # production build, CSP + header assertions
npm run perf:budget                     # production build, per-route JS budget
NEXT_PUBLIC_API_MODE=fixtures npx next build && npx next start -p 3200
E2E_PORT=3200 E2E_PROD=1 npx playwright test
```

## Measured state, 2026-08-07

| Gate | Result |
| --- | --- |
| `tsc --noEmit` (strict) | clean |
| ESLint, `--max-warnings=0` | clean |
| `check:architecture` | no cycles, no layering violations, no production import of a test, across **210 modules** |
| `check:messages` | **663 keys**, `en` and `ar` agree key for key |
| `check:secrets` | no credential-shaped literal in tracked files |
| Jest | **43 suites, 306 tests, 0 failures**, ~4s |
| Coverage | 65.11% statements / 56.38% branches / 59.47% functions / 66.18% lines overall; `src/lib` 89.29 / 77.57 / 88.06 / 91.93 |
| Playwright, production build | **115 tests, 0 failures** across `a11y`, `desktop`, `mobile` |
| axe-core | 0 violations across every route in both locales, plus an open dialog |
| Per-route first-load JS (budget 460 KB / baseline 300 KB) | dashboard 369 · all-operations 377 · branch-cash-flow 368 · withdrawal 247 · roles 238 KB |
| `TODO` / `FIXME` / `HACK` in `src/` | 0 |

## Standards alignment matrix

The column that matters is the last one. "Aligned" means an implemented control
plus a check that fails if it regresses. "Partial" means the control exists and
the verification does not, or the verification is manual and has not been run.
**Nothing here is a certification, and no accredited assessment has taken
place.**

| Standard | Scope claimed | Status | Evidence |
| --- | --- | --- | --- |
| **ISO/IEC 25010:2023** — product quality | Used as a per-module checklist, all eight characteristics | Aligned as a checklist | Per-characteristic table below |
| **ISO/IEC 25023:2016** — quality measures | Six measures defined and automated; the rest not instrumented | Partial | Measures table below |
| **ISO/IEC 27034** — application security | Application-level controls in an Organization Normative Framework the bank owns, not this repo | Partial, by construction | [SECURITY.md](../SECURITY.md); the ONF, threat model and risk acceptance are the deploying organisation's |
| **OWASP ASVS 4.0.3 L1** | Frontend-attributable requirements | Aligned for what a browser client can satisfy | [SECURITY.md § Validation sweep](../SECURITY.md#validation-sweep) — 20 attack classes with verdicts; `e2e/security.spec.ts` |
| **OWASP ASVS 4.0.3 L2** | Frontend-attributable requirements | Partial | Session, authorization, output encoding and configuration controls are in place; V2/V3/V7/V10 are predominantly server-side and unverifiable here |
| **WCAG 2.2 Level AA** | Every route, both locales, twelve widths | Automated criteria aligned; AT-dependent criteria unverified | `e2e/a11y.spec.ts` (axe, 0 violations), `e2e/responsive.spec.ts` (1.4.10, 2.5.8), focus-not-obscured geometry (2.4.11); [ACCESSIBILITY.md § Known gaps](../ACCESSIBILITY.md#known-gaps) |
| **NIST SSDF (SP 800-218)** | PO, PS, PW practice groups reachable from a repository | Partial | Table below |

### ISO/IEC 25010 — per characteristic

| Characteristic | Evidence | Assessment |
| --- | --- | --- |
| Functional suitability | 40 route pages, every register with a wizard, approvals, exports; fixtures make each path runnable without a backend | Complete against the specified scope. Banking Services was never specified and is not built ([README § Open items](../../README.md#open-items)). |
| Performance efficiency | Budget enforced in CI from real `PerformanceResourceTiming` on a production build; heaviest route 377 KB against a 460 KB budget | Enforced |
| Compatibility | Modern evergreen browsers; no server-side rendering dependency ([ADR-0005](../adr/0005-the-panel-renders-in-the-browser.md)) | Adequate; no browser matrix has been tested beyond Chromium |
| Usability | Bilingual with real RTL, keyboard shortcuts, Accessibility Center, one feedback layer ([ADR-0008](../adr/0008-one-answer-to-did-that-work.md)) | Strong; no usability study with real operators has been run |
| Reliability | Error boundaries per route, per-query error states, failure paths tested, `useNotifiedAction` guarantees a failed save never looks like a success | Strong |
| Security | See the ASVS rows; httpOnly session, CSP with per-request nonce, no `dangerouslySetInnerHTML`, CSV formula-injection and BiDi neutralisation | Strong for a frontend; the boundary is the backend's |
| Maintainability | Layering enforced by a build step, 663 externalised strings, 9 ADRs, 11 documents, 0 TODOs | Strong |
| Portability | Environment-only configuration, no vendor SDK, telemetry is a sink ([ADR-0006](../adr/0006-telemetry-is-a-sink-not-a-vendor.md)) | Strong |

### ISO/IEC 25023 — measures actually instrumented

| Measure | Value | Source |
| --- | --- | --- |
| Test coverage (statement) | 65.11% overall, 89.29% in `src/lib` | `npm run test:coverage` |
| Test pass rate | 306/306 unit, 115/115 E2E | Jest, Playwright |
| Static defect density | 0 type errors, 0 lint warnings, 0 architecture violations | `typecheck`, `lint`, `check:architecture` |
| Accessibility conformance rate | 0 axe violations across all routes × 2 locales | `e2e/a11y.spec.ts` |
| Resource utilisation (transfer size) | 238–377 KB JS per route | `npm run perf:budget` |
| Localisation completeness | 663/663 keys in both locales | `npm run check:messages` |

Not instrumented: mean time to repair, failure rate in production, user error
rate, task completion time. All four need a deployment and real operators.

### NIST SSDF — practice by practice

| Practice | Status | Evidence |
| --- | --- | --- |
| PO.3 Supporting toolchains | Aligned | CI runs every gate; [CI_CD.md](../CI_CD.md) |
| PO.5 Secure environments | Partial | Branch protection is documented and must be applied by a repo admin — the pipeline is advisory without it |
| PS.1 Protect code | Partial | Same dependency: required reviews and status checks are a GitHub setting, not a file |
| PS.2 Verify integrity | Not claimed | No artefact signing or provenance attestation |
| PW.4 Reuse well-secured software | Aligned | `npm audit` and CodeQL in CI; the runtime dependency set is deliberately small |
| PW.5 Create source code securely | Aligned | Strict TS, ESLint, layering rules, `check-secrets`, no `dangerouslySetInnerHTML` in `src/` |
| PW.7 Review code | Partial | Required reviews are documented, not enforced by this repository |
| PW.8 Test executable code | Aligned | Unit, component, E2E, a11y, performance, security-header tests, all in CI |
| RV.1 Identify vulnerabilities | Partial | Dependency and CodeQL scanning exist; there is no runtime vulnerability intake for a deployed instance |

## Quality score

Weighted, out of 100. A category scores what its evidence supports, not what its
intent was.

| Category | Weight | Score | Why not higher |
| --- | --- | --- | --- |
| Architecture & maintainability | 15 | 97 | Layering, ADRs and zero TODOs are all enforced. `approval-queue.tsx` remains the worst hotspot at 8.78/10. |
| Security | 20 | 94 | Every frontend-attributable ASVS L1 control is implemented and header-tested. Capped because the panel's real boundary is a backend this repository cannot verify, and because no third-party penetration test has been run. |
| Accessibility | 15 | 93 | 0 axe violations, and 2.4.11 / 2.5.8 / 1.4.10 asserted numerically. Capped because no assistive technology has driven the panel end to end — the script exists and nobody has run it. |
| Testing & quality assurance | 15 | 92 | 421 automated tests, all green, including failure paths. Capped by 56% branch coverage overall and the absence of visual-regression and contract tests. |
| Performance | 10 | 95 | Budget measured from a real production build and gated in CI. No field data yet — the Web Vitals pipeline exists but no deployment has registered a sink. |
| Observability & operability | 10 | 92 | Typed events, correlation, build identity, diagnostics panel, and a documented wiring path. Capped because nothing is emitted until a deployment acts. |
| UX & internationalisation | 10 | 96 | Real RTL, 663 externalised keys, one feedback contract, six analytics surfaces each answering a distinct question. Capped because no operator study has been done. |
| CI/CD & operational readiness | 5 | 88 | Every gate runs on every PR. Capped because branch protection, environment secrets and the deployment target are settings outside this repository. |

**Weighted total: 93.9 / 100.**

That is below the 98 the sprint aimed at, and the gap is not repairable from
inside this repository. Of the eight caps above, six require something the
frontend cannot supply: a real backend, a deployed instance, a screen-reader
operator, a penetration test, a repo admin, and field traffic. Claiming 98 would
mean scoring intent instead of evidence, which is the specific failure this
document exists to avoid.

**With the frontend-only items in the roadmap below completed** — manual AT
validation run and its findings fixed, branch protection applied, branch
coverage raised — the same rubric lands at approximately **97**. The remaining
three points are backend and deployment.

## Technical debt register

| # | Item | Where | Cost of leaving it | Effort | Owner |
| --- | --- | --- | --- | --- | --- |
| D1 | Manual accessibility validation script written but never run | [ACCESSIBILITY.md § Manual validation](../ACCESSIBILITY.md#manual-validation) | Unknown AT defects; axe covers roughly a third of AA | 2–3 days | Frontend |
| D2 | Branch coverage 56% overall | `jest.config.ts` | Error branches in components are the least-exercised code and the most defect-prone | 3–5 days | Frontend |
| D3 | Ledger aggregates computed from a bounded 200-row sample | `all-operations/page.tsx` | Chart mix can differ from the exact total; explained in the subtitle rather than fixed | Backend endpoint | Backend |
| D4 | `approval-queue.tsx` is the repository's worst hotspot (8.78/10) | `src/components/modules/approval-queue.tsx` | Highest-consequence screen with the highest change cost | 1–2 days | Frontend |
| D5 | No API contract test against a real backend | `src/lib/api/` | Fixtures can drift from the real contract silently | Needs a staging API | Both |
| D6 | Charts are not navigable point by point | `src/components/charts/` | Screen-reader users read the table, not the chart — acceptable, but AAA-adjacent | 2 days | Frontend |
| D7 | No visual regression suite | — | Deliberate, recorded in [TESTING.md](../TESTING.md#what-is-not-tested-and-why) | — | Accepted |
| D8 | Countries/currencies reference data ownership unresolved | [README § Open items](../../README.md#open-items) | The panel may be maintaining data the backend should own | Decision | Backend |
| D9 | Banking Services module unspecified and unbuilt | — | Known scope gap, not an omission | Specification | Product |

## Remaining risks

| Risk | Likelihood | Impact | Mitigation in place | What closes it |
| --- | --- | --- | --- | --- |
| A backend endpoint's real shape differs from the fixture | Medium | High — a register silently renders wrong values | [API_CONTRACT.md](../API_CONTRACT.md) states every assumption and lists five open questions; zod validates at the boundary | Integration against a staging API |
| The UI's permission model is treated as a security boundary | Low | Critical | Documented in [SECURITY.md](../SECURITY.md): the panel hides what an operator may not do; the backend must refuse it | Backend authorization review |
| Assistive-technology defects invisible to axe | Medium | High for AA conformance | Semantic markup throughout, live regions, focus management, all reviewed by hand | Running D1 |
| Branch protection never applied | Medium | High — every gate becomes advisory | [CI_CD.md § Required branch protection](../CI_CD.md#required-branch-protection) names the exact settings | A repo admin, 10 minutes |
| No observability in production because no sink is registered | High | Medium — incidents stay unexplained | The wiring is 10 lines and documented | A deployment decision |
| Turnstile is a third-party script under CSP | Low | Medium | Scoped CSP allowance, documented exclusion from the a11y audit | Vendor's own conformance |
| Session handling depends on the backend's cookie flags | Medium | Critical | [ADR-0001](../adr/0001-the-session-is-a-cookie-the-panel-cannot-read.md); the panel never reads or stores a token | Backend sets `HttpOnly; Secure; SameSite` |

## Production readiness

**Verdict: ready to deploy behind the conditions below.** No frontend defect
found in this sprint is outstanding.

Blocking conditions, none of which this repository can satisfy:

1. The backend serves the endpoints in [API_CONTRACT.md](../API_CONTRACT.md) and
   sets the session cookie `HttpOnly; Secure; SameSite=Lax` or stricter.
2. HTTPS with HSTS at the edge; the host applies the headers in
   [DEPLOYMENT.md § HTTPS and headers](../DEPLOYMENT.md#https-and-headers).
3. Required environment variables are set — the app refuses to start without
   them, by design (`src/lib/env.ts`).
4. Branch protection applied as documented, or the CI gates are decorative.

Strongly recommended before the first branch goes live:

5. Register a telemetry sink, or the first production incident has no evidence.
6. Run the manual accessibility script (D1).
7. One integration pass against a staging backend (D5).

## Roadmap

**Frontend only — this repository, in priority order**

1. Run the manual AT validation script and fix what it finds (D1). Highest value
   per day of the whole list: it is the difference between "AA where a tool can
   check" and "AA".
2. Raise branch coverage toward 65%, targeting error branches in components
   (D2). Verification: the ratchet in `jest.config.ts` moves up and stays green.
3. Decompose `approval-queue.tsx` (D4). Verification: hotspot score and the
   module's own test count.
4. Chart point-by-point navigation (D6).

**Backend or infrastructure — not this repository**

1. Apply branch protection (10 minutes, unblocks the entire CI investment).
2. Register a telemetry sink in the deployment.
3. Provide the OpenAPI document, and reconcile the five open questions in
   [API_CONTRACT.md](../API_CONTRACT.md).
4. Add ledger aggregate endpoints, which deletes the bounded-sample caveat (D3).
5. Decide ownership of countries and currencies reference data (D8).
6. Commission a penetration test of the deployed system — the one thing that
   would lift the security score above 94, and it cannot be done from a
   repository.
7. Specify Banking Services (D9).

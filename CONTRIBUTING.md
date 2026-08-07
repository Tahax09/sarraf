# Contributing

## Getting it running

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

`src/lib/env.ts` throws at startup if a required variable is missing, so a bad
environment fails loudly rather than at the first fetch. Required:
`NEXT_PUBLIC_API_BASE_URL`.

Set `NEXT_PUBLIC_API_MODE=fixtures` to run against the in-memory dataset in
`src/lib/api/fixtures/` — it pages, filters, sorts and mutates, so registering,
approving and cancelling all work for the life of the process. Every test in the
repository runs this way, and it is the fastest way to work on the UI without a
backend.

## The gates

Run before opening a pull request. All of them, in this order:

```bash
npm run typecheck                 # tsc --noEmit, strict
npm run lint -- --max-warnings=0
npm run check:messages            # ar/en catalogues must agree, key for key
npm run check:architecture        # no cycles, layers point one way
npm run check:secrets             # no credential-shaped literal in source
npm test                          # jest
npm run test:e2e                  # playwright
npm run test:e2e:a11y             # axe-core over every route
npm run perf:budget               # production build + JS budget
npm run check:prod                # the same build, plus the production CSP
```

`perf:budget` builds and serves on port 3200, so it is the slow one; run it when
you touched a dependency, a route, or anything in the shared graph.

Coverage thresholds are in `jest.config.ts` and are described there as *a
ratchet, not a target*: they are set just under where coverage currently sits, so
they catch a drop without inviting tests written to move a number.

What each level is for — and what is deliberately not tested — is in
[docs/TESTING.md](docs/TESTING.md). The same jobs run in CI; the branch
protection they expect is in [docs/CI_CD.md](docs/CI_CD.md).

## Rules that are not negotiable

These are the ones that produce a request for changes on their own:

1. **No string in a component.** Every visible word comes from `messages/ar.json`
   and `messages/en.json`. `check:messages` fails if the two catalogues
   disagree on a key or carry an empty value, and a test walks every
   `useTranslations` call in `src/` and fails on a missing key. Arabic first —
   see [ADR-0002](docs/adr/0002-arabic-first-and-direction-by-property.md).
2. **Logical properties only.** `ms-` / `me-` / `ps-` / `pe-` / `text-start` /
   `end-0`. Never `ml-`, `text-left`, `right-0`. No component asks which
   direction it is in to lay itself out.
3. **No `any`.** `unknown` plus a narrow where a payload is genuinely unknown.
4. **No `dangerouslySetInnerHTML`.** There is none in `src/`. Adding one is a
   security review, not a refactor.
5. **No credential in browser storage.** The session is an httpOnly cookie the
   panel cannot read ([ADR-0001](docs/adr/0001-the-session-is-a-cookie-the-panel-cannot-read.md)).
   The only things written to storage are view preferences under `saraf.`.
6. **No API shape outside `src/lib/api/`.** Paths live in `endpoints.ts`, types
   in `types.ts`, and together they are
   [the contract](docs/API_CONTRACT.md).
7. **Accessibility does not regress.** New interactive markup ships with an
   accessible name, a keyboard path and a focus state in the same commit.
8. **No gradients.** A design constraint, and a deliberate one.

## Where code goes

| You are writing | It goes in |
| --- | --- |
| A page, its queries and its columns | `src/app/[locale]/(app)/**/page.tsx` |
| A reusable half of a page — a queue, a wizard, an edit dialog | `src/components/modules/` |
| Something several pages compose — table, filter bar, export actions | `src/components/shared/` |
| A design-system primitive that knows nothing about the domain | `src/components/ui/` |
| A call to the backend | `src/lib/api/` |
| Formatting, permissions, filters, labels | `src/lib/` |

The dependency direction is one way: pages → modules → shared → ui. Nothing in
`ui/` knows what an account is.

Full map in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Comments

A comment that restates the line below it is noise. A comment naming the
alternative that was rejected is why the file survives its author. Write the
second kind; delete the first.

When the *why* is bigger than a comment — when a reasonable engineer would do it
differently, or the reason is a constraint outside this repository — write an
ADR instead. `docs/adr/README.md` says how; the short version is that a record
is never edited to match a change of mind, it is superseded.

## Tests

- **Unit** (`jest`, jsdom) for logic in `src/lib/` and behaviour in components.
  `renderWithProviders` from `@/test/utils` renders the **Arabic** default
  locale — assert on Arabic copy, or on roles and labels rather than on words.
- **E2E** (`playwright`, fixtures) for flows that cross a page boundary. The
  mobile project runs a Pixel 7 viewport where the desktop `<table>` is hidden
  and a card list renders instead, so select by accessible name or by `visible()`
  from `e2e/helpers.ts`, never by `table`.
- `getByRole(..., { name })` matches by **substring**. Pass `exact: true` when
  one label contains another — which happens constantly in Arabic
  (اليوم / اليوم السابق / اليوم التالي).
- A test that fails intermittently gets fixed or deleted. A flaky gate is not a
  gate.

## Pull requests

Small, one concern, gates green. Say what changed and what you decided against —
the second is usually the more useful half. If you touched security,
accessibility, performance or the API contract, say which document you updated;
if none needed updating, say why.

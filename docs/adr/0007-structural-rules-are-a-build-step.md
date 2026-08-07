# ADR-0007 — Structural rules are a build step, not a convention

- **Status:** accepted
- **Date:** 2026-08-07
- **Applies to:** `scripts/check-architecture.mjs`, the whole of `src/`

## Context

The repository has a layering it never enforced. `src/lib` is
framework-agnostic logic, `src/components` renders it, `src/app` routes them.
Everyone agreed; nothing checked.

Type checking proves the code compiles. ESLint proves each file is written the
way the team writes files. Neither notices that a utility started importing a
React component, or that two modules quietly began importing each other. Both of
those are cheap to introduce, expensive to unpick a year later, and — this is
the part that matters — **invisible in a diff**. The reviewer sees one new
`import` line at the top of a file they were not otherwise reading.

The failure mode of an import cycle is specific and nasty: it makes module
initialisation order load-bearing. It works until a bundler or a new entry point
evaluates the ring from the other side, and then it fails as an `undefined` at
module scope with no stack trace worth reading.

## Decision

Three rules, checked by a script that exits non-zero, wired into CI and
`npm run check:architecture`:

1. **No import cycles.** The graph is walked depth-first and the whole ring is
   printed, not just the offending pair — the pair is rarely where the fix goes.
2. **Layers point one way.** `src/lib/` → `src/components/` → `src/app/`. A
   lower layer may not import a higher one.
3. **No reaching into a sibling's private folder.** In practice this is
   importing another module's `__tests__`, which is always a mistake and which
   one rule can catch because the layout makes it checkable.

Tests are exempt from rules 2 and 3 — a test may import whatever it exercises,
and several component tests render the route page that composes them, which is
the point of the test. They are **not** exempt from rule 1: a test that closes a
cycle is still a cycle.

Only `@/`-aliased imports are resolved. A relative import inside one folder
cannot cross a layer boundary, and package imports are not ours to police.

The failure message says what to do: *move the file*. Adding an exception is
allowed, but it means editing the rule in `check-architecture.mjs` and saying
why in the commit — which is the friction that keeps exceptions rare.

## Consequences

**What this costs.** A build step of our own to maintain, 175 lines including
its reasoning. It resolves imports with regexes rather than the TypeScript
compiler, so a dynamically-computed import specifier is invisible to it — which
is acceptable, because a dynamically-computed specifier is already something a
reviewer must look at. Occasionally it will be right about a rule and wrong
about a situation, and someone will have to move a file they did not want to
move.

**What it buys.** The layering is now a fact rather than an intention, and it
stays true without any reviewer holding 210 modules in their head. The rules run
in about a second, so they can be a pre-merge gate rather than a periodic audit.
And a new contributor learns the architecture from a failure message on their
first violation, which is the only architecture documentation anyone reliably
reads.

## Alternatives considered

**`eslint-plugin-import` (`no-cycle`) plus `eslint-plugin-boundaries`.** The
conventional answer, and it would work. Rejected on two counts: `no-cycle` is
famously the slowest rule in any ESLint config that enables it — it re-walks the
graph per file, and the repository's lint run is on the critical path of every
commit — and `boundaries` needs a configuration language expressive enough to
describe three prefixes, which is more setup than the three prefixes are worth.
The bigger reason is diagnostic quality: `no-cycle` reports the edge, and the
script reports the ring.

**A `dependency-cruiser` config.** Genuinely good at this, and a real
dependency with its own config dialect for a rule set that fits in a page of
JavaScript. Worth revisiting if the rules grow past a handful.

**Leave it to review.** What the repository did before, and the reason two of
the three rules were already being broken by the time anyone looked. Structural
drift is precisely the class of problem review is bad at, because each
individual violation looks fine.

**TypeScript project references.** Would enforce the layer direction in the
compiler, which is stronger than a script. Rejected as disproportionate: it
means splitting the repository into multiple `tsconfig` projects with build
outputs, and paying that in every editor and every build, to enforce one arrow.

# ADR-0002 — Arabic first, and direction expressed as a property

- **Status:** accepted
- **Date:** 2026-06-24
- **Applies to:** `src/i18n/`, `src/app/globals.css`, `messages/`, every component

## Context

The operators are in Libya. The panel's working language is Arabic, and English
is the second language, not the source one. Both have to be first-class: an
English-reading auditor and an Arabic-reading teller use the same build on the
same day.

The failure mode a bilingual interface falls into is well known. Direction gets
handled where someone noticed it: a `margin-left` here, an `if (isRTL)` there, a
transform on an icon that happened to look wrong. Each patch is correct and the
whole is unmaintainable, because nothing states the rule and every new component
re-derives it — usually incompletely.

## Decision

**Arabic is the default locale**, and `ar` is what an unprefixed URL resolves to.
The routing carries the locale in the path (`/ar/...`, `/en/...`), so a link is
unambiguous and the switcher preserves the page.

**Direction is a CSS property, not a branch.** Layout is written with logical
properties throughout — `margin-inline-start`, `padding-inline-end`,
`text-align: start`, `inset-inline-end`, and their Tailwind equivalents (`ms-`,
`pe-`, `text-start`, `end-0`). `dir` is set once on `<html>` from the locale.
No component asks which direction it is in to lay itself out.

Three things genuinely do not mirror, and they are named rather than discovered:

- **Directional icons**, which mean "back" and "forward" rather than "left" and
  "right". They carry `rtl-flip`, one utility, defined once.
- **Numbers, amounts and identifiers**, which are laid out left-to-right inside
  an Arabic sentence. `.numeric` is for a single run — an amount, a count.
  `.identifier` is for a value whose internal order carries meaning and must be
  pinned — a phone number, an IBAN, a reference, a timestamp. Values that are
  neither are wrapped in `<bdi>` so a name resolves its own direction without
  disturbing the line around it.
- **Charts**, whose axes follow the reading direction, which recharts does not
  do on its own.

**No string is written in a component.** Every visible word comes from
`messages/ar.json` and `messages/en.json` through `next-intl`.
`scripts/check-messages.mjs` fails the build if the two catalogues disagree on
a single key or carry an empty value, and `src/test/__tests__/i18n-keys.test.ts`
walks every `useTranslations` binding in `src/` and fails if a key it uses is
missing. A raw key on screen is a defect that reaches a branch, not a reviewer,
so it is a gate.

## Consequences

- A new component is right-to-left correct by default, because it never said
  otherwise. `e2e/rtl.spec.ts` sweeps every route in both languages and checks
  the computed direction of what is on screen.
- Adding a label means editing two files. That is the point: a key that exists
  in one catalogue is a key that renders as `nav.reports` for half the users.
- A translation cannot be "temporarily English". The gate does not accept an
  empty string, so the Arabic has to exist before the feature ships.
- Third-party UI that hard-codes a direction has to be wrapped or replaced. This
  is the main constraint on adopting a component library here.

## Alternatives considered

**English as the source language, Arabic as a translation.** Rejected. It makes
Arabic the derived artifact, and the derived artifact is the one that lags.

**Physical properties plus an RTL stylesheet.** Rejected: two stylesheets that
must be kept in agreement, with no mechanism that makes disagreement visible.

**A direction hook components read.** Rejected as the patchwork this record
exists to avoid. It makes every component's correctness depend on remembering to
call it.

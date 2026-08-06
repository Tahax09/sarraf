# Accessibility

The target is **WCAG 2.1 / 2.2 level AA**. This document says what is
implemented, what is verified automatically, and what is not — because a claim
of AA that rests on inspection alone is worth less than a smaller claim with
evidence behind it.

## What is verified, and what that is worth

`e2e/a11y.spec.ts` runs axe-core over **every** route in the app and every public
route, in a real browser, against the fixtures dataset. Tags:
`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`. The suite fails on any
violation and prints the rule, impact and node selectors so a CI log is
actionable on its own.

```bash
npm run test:e2e:a11y
```

Automated testing catches roughly **a third** of AA — the mechanical third:
contrast ratios, missing names, duplicate landmarks, orphaned labels, ARIA that
does not parse. That is exactly the third that regresses silently when someone
edits a colour token or adds a card. The other two thirds — whether the focus
order matches the reading order, whether an error message says something useful,
whether a status change is announced at a moment that helps — are judgement, and
they were reviewed by hand rather than measured.

**So: no page in this app has a known AA violation, and every route is swept on
every run. That is not the same as certified compliance, and this repository
does not claim it.**

One exclusion: the Cloudflare Turnstile container (`[data-turnstile]`) on the
sign-in page. Its markup is inside a cross-origin iframe and is not ours to fix;
excluding it keeps the rest of that page honest rather than letting one
un-actionable violation mask the others.

## Structure and navigation

- One `<main>` per page, one `<h1>`, headings that descend without skipping.
- A **skip-to-content** link is the first focusable element in the app shell —
  visually hidden until focused, then visible.
- The sidebar is a `<nav>` with `aria-current="page"` on the active link.
- Tables are real `<table>` markup with `<th scope>`; the permission matrix
  carries a `<caption>`. Below the `md` breakpoint the table is replaced by a
  card list carrying the same content and the same accessible names.
- Every icon-only control has an `aria-label`; decorative icons carry
  `aria-hidden`.

## Keyboard

Everything is reachable and operable from the keyboard, in a visible order.

- **Focus is always visible.** A single `:focus-visible` rule — 2px outline,
  2px offset — applies to everything, and high-contrast mode widens it to 3px.
  No component removes an outline without replacing it.
- **Dialogs are the native `<dialog>` element.** Modal semantics, focus
  trapping, `Escape`, inertness of the page behind, and focus return on close
  all come from the platform rather than from a hand-written trap, which is the
  main reason there are no focus bugs to list here.
- Sortable column headers are `<button>`s inside `<th>`, announcing the current
  sort through `aria-sort`.
- The global search overlay is a labelled dialog; results are a list, arrow keys
  move through them, `Enter` opens, `Escape` closes.
- **2.5.8 Target Size (Minimum)** — interactive controls are at least 24×24 CSS
  pixels, and touch targets in the mobile card layout are larger.
- **2.4.11 Focus Not Obscured** — sticky headers reserve space rather than
  overlaying scrolled content.

## Announcements

Silent state changes are the classic screen-reader failure, so they are named:

| What changes | How it is announced |
| --- | --- |
| A table's row count after filtering or paging | `aria-live="polite"` region in `data-table.tsx` |
| Loading and error states | `role="status"` inside the skeleton and error states |
| Filter results | polite live region in `filter-bar.tsx` |
| Search result count | polite live region in `global-search.tsx` |
| Field validation errors | `role="alert"`, tied to the input by `aria-describedby` |
| Save/failure outcomes on profile, CBL and operation rules | `role="status"` / `role="alert"` beside the form |

Errors are announced *and* associated: `<Field>` wires `aria-describedby` and
`aria-invalid` from one place, so an input cannot end up with a visible error
message that a screen reader never reaches.

## The Accessibility Center

Operators on shared branch machines often cannot change OS settings, so three
preferences live in the product, in a dialog reachable from the header:

- **Motion** — system / reduced.
- **Contrast** — normal / high.
- **Text size** — normal / large (112.5%) / larger (125%).

Each is a radio group, not a toggle, because "follow my system" is a real third
answer and an on/off switch would silently override the OS.

The choices are written to a cookie (`SARAF_A11Y`) and applied as `data-motion`,
`data-contrast` and `data-text` attributes **server-side**, so a reader never
sees a frame of the default before the preference lands.

- `prefers-reduced-motion: reduce` is honoured independently, so the "system"
  setting is not a no-op — it is the OS query doing the work.
- Text size scales the root font size and the layout is rem-based throughout, so
  125% enlarges without overflowing. This satisfies **1.4.4 Resize Text** in the
  product as well as through browser zoom.
- High contrast raises muted foregrounds and borders without inverting the
  palette — green still means in, red still means out — and adds underlines to
  inline links so colour is never the only cue (**1.4.1 Use of Colour**).

## Colour and contrast

Both themes are token-driven, and axe verifies every rendered pairing on every
route. Body text and UI text meet 4.5:1; large text and non-text UI boundaries
meet 3:1. Status is never carried by hue alone: badges pair colour with a word,
and directional figures pair colour with a sign.

## Language and direction

`<html lang>` and `dir` are set from the locale, so a screen reader picks the
right voice and the right reading order for the whole document. Mixed content is
handled by property rather than by patching:
`.numeric` and `.identifier` pin a value's internal order, and `<bdi>` isolates
a name so it resolves its own direction without disturbing the sentence around
it. The reasoning is in
[ADR-0002](adr/0002-arabic-first-and-direction-by-property.md).

## Known gaps

Stated rather than rounded off:

1. **No assistive-technology testing.** The panel has not been driven end to end
   with NVDA, JAWS or VoiceOver by someone who uses one daily. Everything above
   is semantics plus axe, and semantics plus axe is not a user.
2. **Turnstile is unaudited.** See the exclusion above.
3. **Charts are not navigable point by point.** Every chart carries an
   accessible name and a text alternative: `<ScreenReaderFigures>` renders the
   same numbers as a visually hidden table, and a chart whose card already shows
   a visible table of the same figures passes `figures="adjacent"` so a reader
   is not told twice. Recharts' own tooltips are mouse-only, and moving through
   the SVG series by keyboard is not implemented — the figures table is the
   answer instead.
4. **No cognitive-accessibility review.** WCAG 2.2's AAA cognitive criteria are
   out of scope, and even at AA the wording of errors and confirmations has not
   been tested with users.
5. **Print output is not audited.** The print stylesheet is checked visually.

## Working on this

- Run `npm run test:e2e:a11y` before opening a pull request that touches markup,
  tokens or layout. It is fast and it is the gate.
- New interactive markup means a new accessible name, a keyboard path, and a
  focus state — in the same commit, not a follow-up.
- If a change makes something less accessible, it does not ship. There is no
  balancing test against velocity here; that is the one rule this document is
  for.

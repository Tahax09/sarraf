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
- **2.4.11 Focus Not Obscured (Minimum)** — the app shell puts a `sticky` header
  over every page and a `fixed` quick-nav under every phone one, and the browser
  scrolls a newly focused control flush against the viewport edge, which is
  behind them. `scroll-padding` on the scrolling root (and on the table's own
  scroll container, which has its own sticky header row) keeps the control
  clear. This is geometry after a scroll rather than markup, so axe cannot see
  it: a Shift+Tab sweep in `e2e/a11y.spec.ts` hit-tests every focused element at
  desktop and phone widths and fails if anything else is painted over it.

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
preferences live in the product, in a dialog reachable from the header — and,
equally, from the signed-out pages:

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

### Before sign-in

The dialog is not the header's. `AuthShell` — the frame every signed-out page
renders in — carries the same three controls the shell offers an operator who is
already in: language, theme and the accessibility centre. An operator who needs
larger text or more contrast needs them to read the sign-in form, not once they
are past it, and a reset page that dropped the contrast they had just set would
be taking it away at the worst moment.

Two consequences worth stating:

- The keyboard-shortcut sheet is **not** offered there. Shortcuts are registered
  by the app shell, so a signed-out page has none, and a button that opened an
  empty list would be worse than no button. `useOptionalShortcutRegistry()`
  returns `null` outside the shell and the block is omitted.
- Both preferences are cookies read server-side, so they survive the navigation
  from sign-in to password reset and back, and the next page renders already
  correct rather than correcting itself after paint.

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

**3.1.2 Language of Parts.** A KYC record holds the client's name twice, Arabic
and Latin, and both appear on the same line whichever locale is reading. The
document `lang` cannot be right for both, so `clientNames()` returns the language
of each form alongside it and every name renders as `<bdi lang="…">`. Without it
a reader on an Arabic page pronounces "Ahmed Al-Sharif" with Arabic phonemes,
and an operator matching a passport hears a name that is not the one in their
hand. Which field carries which script is known structurally, so it is declared
rather than sniffed from the characters.

## Known gaps

Stated rather than rounded off:

1. **No assistive-technology testing.** The panel has not been driven end to end
   with NVDA, JAWS or VoiceOver by someone who uses one daily. Everything above
   is semantics plus axe, and semantics plus axe is not a user. The script such
   a pass would follow is written out under [Manual validation](#manual-validation)
   — the gap is that nobody has run it, not that nobody knows what to run.
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
6. **Forced colours are reasoned about, not observed.** Selected, current and
   pressed states carry a `Highlight` outline under `forced-colors: active` so
   they survive Windows High Contrast, but no one has read the panel in that
   mode on Windows. The rest of the palette is the OS's to replace.

## Manual validation

Automation covers the criteria a machine can see. The rest is a person, and the
script below is what that person runs, so the result is repeatable rather than
an impression. Record the date, the versions, and the outcome per row; a run
older than the last release of the shell or the design tokens is stale.

### Screen readers

Three combinations, because the bugs differ by pairing rather than by product.
Arabic first — the panel is Arabic-first, and a reader that mishandles RTL
mishandles the primary locale.

| Reader + browser | Locale | Journey |
| --- | --- | --- |
| NVDA + Firefox | ar, en | Sign in → Dashboard → Clients → open a client → Withdrawal register → submit |
| JAWS + Chrome | ar | Approval queue → approve one → read the outcome announcement |
| VoiceOver + Safari (macOS) | en | Reports → change the date range → export → read the table |
| VoiceOver + Safari (iOS) | ar | Phone quick-nav → Approvals → confirm dialog → dismiss |

Each journey checks the same five things:

1. The page title and the `<h1>` announce on navigation, and they say where you
   are — not "Saraf" four times.
2. Every form field announces its label, its required state, and its error, and
   the error is reachable from the field rather than only at the top.
3. A confirm dialog announces its name and its body on open, traps focus, and
   returns focus to the control that opened it.
4. The result of a save is announced — success or failure with its reference —
   without the reader losing its place.
5. A table announces its caption, its column headers per cell, and its sort
   state, and the mobile card list carries the same names as the desktop rows.

### Zoom and reflow

| Check | Expected |
| --- | --- |
| 200% browser zoom, 1280×720 | No loss of content or function (SC 1.4.4) |
| 400% zoom, 1280×720 → 320 CSS px wide | Single column, no two-dimensional scrolling except tables (SC 1.4.10) |
| Text spacing bookmarklet (line 1.5×, letter 0.12em, word 0.16em, paragraph 2×) | No clipping or overlap (SC 1.4.12) |
| Text-only zoom to 200% in Firefox | Layout holds; nothing truncates |

### Keyboard only

Unplug the mouse for the whole pass.

- Every route in `e2e/helpers.ts` `ROUTES` is reachable and operable.
- The skip link is the first stop and lands on `#main-content`.
- No keyboard trap anywhere, including the search overlay, dialogs, the date
  range picker and the export menu.
- Focus order matches reading order in both directions, in both locales.
- `Escape` closes every overlay, and focus returns to the opener.

### Windows High Contrast / forced colours

- Every control keeps a visible border in forced-colours mode — an outline
  drawn only with `background-color` disappears there.
- Focus indication survives.
- Icon-only buttons remain distinguishable from their background.
- Charts remain readable, or their figures table is the fallback.

### Pointer and motion

- `prefers-reduced-motion: reduce` and the Accessibility Center's reduced-motion
  setting both stop animation.
- Every drag interaction has a click alternative (SC 2.5.7) — currently only the
  logo dropzone, which has a file-picker button.
- Nothing depends on hover alone to reveal content (SC 1.4.13).

## Working on this

- Run `npm run test:e2e:a11y` before opening a pull request that touches markup,
  tokens or layout. It is fast and it is the gate.
- New interactive markup means a new accessible name, a keyboard path, and a
  focus state — in the same commit, not a follow-up.
- If a change makes something less accessible, it does not ship. There is no
  balancing test against velocity here; that is the one rule this document is
  for.

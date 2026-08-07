# Design system

What the panel is built out of, and which of those decisions are enforced by a
test rather than by habit.

## Layout and breakpoints

Tailwind's defaults, unmodified, because a bespoke scale buys nothing and costs
every new contributor an afternoon:

| Token | Min width | What changes |
| --- | --- | --- |
| — | 0 | Single column. Registers are card lists. Navigation is a drawer plus a four-item fixed bottom bar. |
| `sm` | 640px | Two-up KPI cards; the Accessibility Center gets its own header button. |
| `md` | 768px | Registers switch from cards to a real `<table>` in a horizontal scroller. |
| `lg` | 1024px | The sidebar becomes permanent; the drawer and the bottom bar disappear. |
| `xl` | 1280px | The dashboard's quick-actions rail moves beside the content instead of above it; KPI cards go four-up. |

Two consequences worth stating, because they are where the layout bugs come
from:

- **A register exists twice.** Below `md` it is `<ul className="… md:hidden">`
  of cards; above it, `<table className="hidden … md:block">`. They must carry
  the same content and the same accessible names — see
  [ACCESSIBILITY.md](ACCESSIBILITY.md). A column added to one and not the other
  is invisible on half the widths.
- **The phone's bottom bar is `fixed`.** The content column carries `pb-24
  lg:pb-0` so the last row of every page clears it, and the scrolling root
  carries `scroll-padding-bottom` so a focused control does too. Neither is
  optional; removing either hides content that a phone user cannot scroll to.

At the wide end nothing is centred in a fixed measure. A back-office register is
denser than it is readable — an operator reconciling 400 rows wants the columns,
not a 1400px void beside them — so the content column takes the width it is
given. Prose inside cards stays under about 730px at 2560px because the cards
themselves are laid out in a grid, not because a `max-width` is imposed.

## Responsive certification

`e2e/responsive.spec.ts` measures every route in `ROUTES` at twelve widths:

```
320  375  390  414  430  768  1024  1280  1366  1440  1920  2560
```

320 is the reflow floor (WCAG SC 1.4.10 — 400% zoom on a 1280px screen lands
there), 375/390/414/430 are the phones in the field, 768 and 1024 sit either
side of the two breakpoints that change the most markup, and 2560 is the
trading-desk monitor.

Two properties are asserted, both of them things a reviewer cannot reliably see:

1. **No horizontal overflow.** `documentElement.scrollWidth` must not exceed the
   viewport. When it does, the test names the outermost offending elements, and
   it ignores children of a deliberate `overflow-x` scroller — a wide table
   inside its own scroll box is the design. This class of defect is systemic
   rather than local: one flex item missing `min-w-0` in the header took out all
   27 routes at once, and it was invisible on a laptop.
2. **Target size, SC 2.5.8.** Every control is at least 24×24 CSS pixels, checked
   at 375px *and* at 1024px. Both widths, because they render different markup:
   checking only the phone certified half the application, and the column sort
   buttons sat at 16px tall for exactly as long as that was the only width
   measured. They now grow into the header cell's own padding — `-my-1.5 py-1.5`
   — so the hit area clears 24px without the header row getting taller.

What the spec does not certify is whether the result looks right. Overflow and
target size are the two failures that are objective; proportion, density and
rhythm at 2560px are a reviewer's job, and the manual pass is described in
[ACCESSIBILITY.md](ACCESSIBILITY.md#manual-validation).

## Density

Tables carry a comfortable and a compact row height, chosen by the operator and
persisted per browser (`saraf.table`). Compact is not a smaller font — the text
stays at the same size and only the vertical padding changes — because a
supervisor scanning a register at arm's length needs more rows, not smaller
numbers. Target size is measured in the comfortable mode and holds in compact:
the sort button's own padding does not change with density.

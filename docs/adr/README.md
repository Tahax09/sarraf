# Architecture decision records

One file per decision that would otherwise have to be re-derived from the code —
and re-derived wrongly, because the alternatives that were rejected leave no
trace in what shipped.

A record is written when the answer to "why is it like this?" is not visible in
the diff: when a reasonable engineer would do it differently, when the reason is
a constraint outside this repository, or when the decision costs something that
a future reader will want to reclaim without knowing what it bought.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-the-session-is-a-cookie-the-panel-cannot-read.md) | The session is a cookie the panel cannot read | accepted |
| [0002](0002-arabic-first-and-direction-by-property.md) | Arabic first, and direction expressed as a property | accepted |
| [0003](0003-register-state-stays-out-of-the-url.md) | Register state stays out of the URL | accepted |
| [0004](0004-table-pagination.md) | One paging decision per register, stated at the call site | accepted |
| [0005](0005-the-panel-renders-in-the-browser.md) | The panel renders in the browser, and the boundary is the page | accepted |

0001 and 0005 are one thread: where the session lives decides where the code
runs. 0003 and 0004 are another: what a register holds, and who pages it.

## Writing one

Copy the shape of any of the five: context, decision, consequences,
alternatives considered. The last two sections are the ones worth the effort —
consequences are what the next reader is living with, and the rejected
alternatives are what stops the decision being relitigated every six months.

A record is never edited to match a change of mind. Supersede it: add the new
record, set the old one's status to `superseded by NNNN`, and leave its
reasoning intact. The wrong turn is part of the map.

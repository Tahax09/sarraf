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
| [0006](0006-telemetry-is-a-sink-not-a-vendor.md) | Telemetry is a sink, not a vendor | accepted |
| [0007](0007-structural-rules-are-a-build-step.md) | Structural rules are a build step, not a convention | accepted |
| [0008](0008-one-answer-to-did-that-work.md) | One answer to "did that work?" | accepted |
| [0009](0009-every-analytics-surface-answers-a-different-question.md) | Every analytics surface answers a different question | accepted |

Four threads run through these. 0001 and 0005: where the session lives decides
where the code runs. 0003 and 0004: what a register holds, and who pages it.
0006 and 0008: a failure has exactly one route out of the browser — to the
operator as a message, to the sink as a record — and neither route knows which
vendor is on the other end. 0007 and 0009 are both refusals to trust discipline:
one makes the layering a build step, the other makes "does this answer a new
question?" the price of a new screen.

## Writing one

Copy the shape of any of the nine: context, decision, consequences,
alternatives considered. The last two sections are the ones worth the effort —
consequences are what the next reader is living with, and the rejected
alternatives are what stops the decision being relitigated every six months.

A record is never edited to match a change of mind. Supersede it: add the new
record, set the old one's status to `superseded by NNNN`, and leave its
reasoning intact. The wrong turn is part of the map.

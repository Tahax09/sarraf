# ADR-0009 — Every analytics surface answers a different question

- **Status:** accepted
- **Date:** 2026-08-07
- **Applies to:** `src/app/[locale]/(app)/core/analytics/**`, the dashboard, `src/components/modules/client-concentration.tsx`, `src/lib/concentration.ts`

## Context

Analytics screens accrete. Someone asks for a chart, a chart is added, and a
year later the panel has six of them showing the same totals cut six ways. Each
one is defensible on its own; together they are a maze in which the operator
cannot find the number they came for, and every one of them costs a query, a
render and a translation key forever.

This panel had the beginnings of that. Three analytics routes plus a dashboard,
some overlapping totals, and a "top clients" table whose headline figure — a
list of the largest balances — is genuinely hard to act on. A list of big
balances reads identically whether those clients hold three per cent of the
money on deposit or eighty, and only one of those is a liquidity question.

There was also a correctness problem underneath the presentation one. The
activity panel's "total activities" summed a per-day series that double-counted
days with more than one event type and dropped days with none, so the headline
never matched the feed beneath it — the class of defect nobody reports, because
the reader assumes they have misunderstood the metric.

## Decision

**A surface earns its place by answering a question no other surface answers.**
Restating another view's numbers in a different shape is not an answer.

The map, stated so a future addition has something to be measured against:

| Surface | The question |
| --- | --- |
| Dashboard | *Is anything waiting on me, and how has the week moved?* |
| Reports | *What happened on one specific day?* |
| Branch cash flow | *Which branch is moving the money?* |
| All operations | *Which records, exactly — and of what mix?* |
| Activity | *Who did what, and when?* |
| Top clients | *Who holds the money, and how much of the book is that?* |

The same table, with the endpoint each surface reads, is in
[ARCHITECTURE.md](../ARCHITECTURE.md#analytics). The rule is not "no repeated
numbers" — a figure may legitimately appear on two screens if it answers two
different questions — but **no surface may exist only to restate another**.

Three rules follow from that framing:

1. **Every chart states its scope.** The backend exposes no aggregate endpoint
   for the ledger, so a mix or a volume figure has to be computed from rows the
   page holds. Rather than let that silently become "whatever page you are on",
   the charts read a **fixed, bounded sample** (`CHART_SAMPLE_SIZE = 200`) and
   say so in the card's own subtitle. A chart whose denominator moves when you
   click "next page" is worse than no chart.
2. **A percentage names its denominator, and the denominator is the backend's.**
   Concentration divides by the backend's per-currency total — the same figure
   the dashboard's balances card draws — so a share is a share of the book and
   not a share of what happens to be on screen. A currency the balances endpoint
   does not cover is **dropped**, not shown against an invented whole.
3. **Numbers on the same screen must be able to disagree with each other, and
   then agree.** A headline is computed from the same rows as the list beneath
   it, and the arithmetic lives in `src/lib/` with unit tests, not inline in a
   component where nobody can check it.

Charts are decoration around a table, never a replacement for it. Every
analytics surface renders the exact figures next to the picture, because the
picture answers "is anything unusual" and only the figures answer "by how much"
— and the figures are what gets read to a regulator, exported to a workbook, or
pasted into a ticket. That is also why every chart's data is reachable by
keyboard and by screen reader through the table rather than through the SVG.

## Consequences

**What this costs.** Saying no. The rule's whole value is in the charts that do
not get built, which is an unpopular thing to enforce and impossible to
demonstrate afterwards. Bounded samples also mean two figures on the same page
can legitimately differ — a 200-row chart mix beside a 12,000-row exact total —
and that has to be explained in the subtitle rather than hidden by rounding.

**What it buys.** Six surfaces an operator can hold in their head, each with a
sentence describing when to open it. Metrics whose denominators are stated, so a
share is auditable rather than plausible. And a review criterion for the next
request: *which of these six questions does it answer, and if it is a new one,
what is it?*

**What it does not decide.** Whether the backend should grow aggregate
endpoints. It should — a real `GET /analytics/ledger-summary` would replace the
bounded sample with an exact figure and delete rule 1. This is recorded in the
roadmap as a backend item, not worked around further here.

## Alternatives considered

**A configurable dashboard with user-arranged widgets.** The enterprise-sounding
answer. Rejected as the same problem with a persistence layer: it converts "we
have six charts nobody can interpret" into "everyone has a different six", and
it makes support impossible because no two operators see the same screen.

**A charting/BI embed.** Correct if the questions were open-ended. They are not
— this is a back office with six recurring questions and a regulator — and an
embed brings a second auth model, a second theme, a second direction problem and
a large bundle.

**Compute the ledger aggregates client-side over every row.** Would remove the
bounded-sample caveat by fetching everything. Rejected: it moves an unbounded
amount of sensitive data into a browser on a branch workstation to compute a
number the server is better placed to compute, and it degrades exactly when the
book grows large enough for the number to matter.

**Leave the top-clients table as it was.** Cheapest, and the reason the ADR
exists: the table was already there and already looked finished. The defect was
that it presented data as though it were an answer.

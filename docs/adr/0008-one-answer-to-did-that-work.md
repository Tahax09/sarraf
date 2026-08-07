# ADR-0008 — One answer to "did that work?"

- **Status:** accepted
- **Date:** 2026-08-07
- **Applies to:** `src/components/providers/feedback-provider.tsx`, every mutation call site

## Context

A mutation that failed did nothing visible. The spinner stopped, the dialog
stayed open, and the operator inferred the outcome from whether the register
behind it had changed.

That is a defect rather than a rough edge, because in this application the two
outcomes are not symmetric. Silence and success look identical, the natural
response to silence is to press the button again, and the button in question
sends money. A double-submitted transfer is a real reconciliation problem, and
the UI was inviting one.

The mirror-image bug was already in the tree in several places:

```ts
await save.mutateAsync(values);
onClose();
```

A rejected promise leaves the dialog open with no message at all. A fulfilled
one closes it with no confirmation. Both are one line away from correct, both
read as correct in review, and there were nine call sites.

## Decision

**One provider owns the answer, and one hook decides what a call site does with
it.**

`FeedbackProvider` renders a portalled live region. `useNotifiedAction` wraps a
mutation and returns a `boolean`:

```ts
const act = useNotifiedAction();
const ok = await act(() => save.mutateAsync(values), { success: t("saved") });
if (ok) onClose();
```

The returned boolean is the whole point. **Close on success, hold on failure**
is decided once, in a hook, rather than nine times in nine `try`/`catch` blocks
that each have to remember it.

Four rules the layer enforces:

1. **Success is transient, failure is not.** A success auto-dismisses after six
   seconds: it confirms something the operator already intended, and a
   confirmation that must be cleared is a second click for no information. A
   failure stays until dismissed, because the operator may have looked away, and
   because the reference they need to write down cannot be recovered once it is
   gone.
2. **Failure interrupts, success does not.** The region is `aria-live="polite"`;
   a failure additionally carries `role="alert"`. A screen-reader user hears a
   rejection at the moment it happens, and is not interrupted by an outcome they
   expected.
3. **The message is always one this application wrote.** A backend error string
   can carry internals, is untranslated, and is rarely something an operator can
   act on. What surfaces is a translated sentence plus a quotable reference —
   the same contract `ErrorPanel` already keeps.
4. **Every failure is also reported.** `useNotifiedAction` calls `reportError`
   before it notifies, so the sink (ADR-0006) sees the failure whether or not
   anyone reads the toast.

Placement is bottom-inline-end, `end` rather than `right` so it follows the page
into RTL, and deliberately away from a dialog's primary action — which is where
the operator's eye already is.

## Consequences

**What this costs.** A provider in the tree for every page, including the ones
that never mutate anything. One more thing a call site must remember to use —
nothing stops someone writing a bare `mutateAsync`, and only review catches it.
And the toast is a global surface: a rule about it is a rule about every screen
at once, which makes it hard to make an exception for one flow that wants
something else.

**What it buys.** Nine call sites lost their bespoke error handling, and the
"close on success, hold on failure" rule became a property of the codebase
rather than of each author's discipline. Accessibility of the outcome is decided
in one file, so `role="alert"` is not something anyone has to remember. And
because failures route through `reportError`, the operator's "it didn't work" is
matched by a record on the other side.

**What it does not decide.** Optimistic updates and retry policy belong to
TanStack Query; this layer reports whatever that concludes.

## Alternatives considered

**A toast library (`sonner`, `react-hot-toast`).** Would have shipped in an
afternoon and does the rendering well. Rejected because the rendering is not the
hard part — the asymmetry between success and failure is, and a library gives a
`toast.error()` that any call site can use without adopting any of the four
rules above. The bundle is on a budget (see [PERFORMANCE.md](../PERFORMANCE.md))
and this is roughly 120 lines.

**Per-component error state.** What the code did before, and what produced the
bug: each dialog holding an `error` string, each rendering it slightly
differently, and several not rendering it at all.

**Inline errors only, no toast.** Correct for form validation, and this
repository still does exactly that for field-level errors. It fails for the
outcome of a submit that closed its own dialog, or an action fired from a table
row, where there is no longer a form to render into.

**Throwing to an error boundary.** Right for a render that cannot continue,
wrong for a save that failed: the operator's data is still on screen and still
valid, and replacing the page with an error panel throws it away.

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { useSaveShortcut } from "@/lib/shortcuts";
import { errorReference, reportError } from "@/lib/report-error";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  title: string;
  content: ReactNode;
  /** Resolve false to block advancing (used for per-step zod validation). */
  validate?: () => Promise<boolean> | boolean;
};

/**
 * Step shell shared by every register form. One column on mobile, the step
 * rail moves above the content below the tablet breakpoint.
 *
 * `onSubmit` may return a promise. If it rejects, the failure is shown on the
 * step the operator is already looking at rather than swallowed: a money
 * movement that did not happen must not look like one that did, and the
 * register these forms redirect to on success is several seconds away from
 * telling anyone otherwise.
 */
export function FormWizard({
  steps,
  onSubmit,
  submitting,
  submitLabel,
}: {
  steps: WizardStep[];
  onSubmit: () => void | Promise<unknown>;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const t = useTranslations("common");
  const tSteps = useTranslations("steps");
  const [index, setIndex] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const busy = submitting || running;
  const step = steps[index];
  const isLast = index === steps.length - 1;

  async function next() {
    if (step.validate && !(await step.validate())) return;
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  // Ctrl/Cmd+S submits, but only from the last step — that is the only place
  // the form is complete, and a chord that half-saves a money movement would be
  // worse than no chord. Disabled while a submit is in flight so a held key
  // cannot fire the same mutation twice.
  async function submit() {
    setFailure(null);
    setRunning(true);
    try {
      await onSubmit();
    } catch (error) {
      reportError(error, { boundary: "form-wizard" });
      setFailure(errorReference(error as { digest?: string }));
    } finally {
      setRunning(false);
    }
  }

  useSaveShortcut(submit, { disabled: !isLast || busy });

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
        {steps.map((s, i) => {
          const done = i < index;
          const current = i === index;
          return (
            <li key={s.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => (i <= index ? setIndex(i) : undefined)}
                aria-current={current ? "step" : undefined}
                disabled={i > index}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors",
                  current
                    ? "bg-accent-soft font-medium text-accent"
                    : done
                      ? "text-fg hover:bg-surface-muted"
                      : "text-fg-subtle",
                )}
              >
                <span
                  className={cn(
                    "numeric flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                    current
                      ? "border-accent text-accent"
                      : done
                        ? "border-success text-success"
                        : "border-border text-fg-subtle",
                  )}
                >
                  {done ? <Check className="size-3" aria-hidden /> : i + 1}
                </span>
                <span className="truncate">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardBody>
          <p className="mb-4 text-xs text-fg-muted">
            {tSteps("stepOf", { current: index + 1, total: steps.length })}
          </p>
          {step.content}
          {failure ? (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {t("submitFailed")}{" "}
              <span className="numeric">
                {t("submitFailedReference", { reference: failure })}
              </span>
            </p>
          ) : null}
        </CardBody>
        <CardFooter className="justify-between">
          <Button
            variant="secondary"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0 || busy}
          >
            <ChevronRight className="rtl-flip size-4 rotate-180" aria-hidden />
            {t("previous")}
          </Button>
          {isLast ? (
            <Button onClick={submit} loading={busy}>
              {submitLabel ?? t("submit")}
            </Button>
          ) : (
            <Button onClick={next}>
              {t("next")}
              <ChevronLeft className="rtl-flip size-4 rotate-180" aria-hidden />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

/** Key/value review list used by the final step of every register form. */
export function ReviewList({
  items,
}: {
  items: { label: ReactNode; value: ReactNode; numeric?: boolean }[];
}) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {items.map((item, i) => (
        <div key={i} className="flex items-start justify-between gap-4 px-3 py-2.5">
          <dt className="text-xs text-fg-muted">{item.label}</dt>
          <dd
            className={cn(
              "text-end text-sm font-medium text-fg",
              item.numeric && "numeric",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

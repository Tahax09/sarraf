"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextArea, TextInput } from "@/components/ui/field";
import { errorReference, reportError } from "@/lib/report-error";

/**
 * Confirmation gate for high-stakes actions: approvals, cancellations, user
 * deactivation, role permission edits, currency/branch deletion.
 *
 * `requireTyped` adds a type-to-confirm step for the destructive/irreversible
 * end of that list.
 *
 * `onConfirm` may return a promise, and if it rejects the dialog stays open and
 * says so. That is the whole reason the signature is not `() => void`: an
 * approval that failed used to stop the spinner and change nothing else, which
 * is indistinguishable from an approval that succeeded and is the state most
 * likely to be clicked through twice.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = "primary",
  loading,
  requireTyped,
  reason,
  blocked,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: { reason?: string }) => void | Promise<unknown>;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "success";
  loading?: boolean;
  requireTyped?: boolean;
  /** Optional free-text reason captured with the confirmation (cancellations). */
  reason?: { label: string; required?: boolean };
  /**
   * Why the action cannot proceed. Set it and the dialog explains the block and
   * refuses to confirm, instead of letting the operator arm a request the
   * backend will only reject.
   */
  blocked?: ReactNode;
}) {
  const t = useTranslations("common");
  const tc = useTranslations("confirm");
  const [typed, setTyped] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  // Set when `onConfirm` rejects. Holds the quotable reference, not the
  // backend's message: that can carry internals, is not translated, and is not
  // something an operator can act on.
  const [failure, setFailure] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Closing wipes the typed confirmation and the reason so the next dialog
  // never opens pre-filled. Adjusted during render rather than in an effect.
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setTyped("");
      setReasonText("");
      setFailure(null);
    }
  }

  const busy = loading || running;
  const word = tc("word");
  const typedOk = !requireTyped || typed.trim() === word;
  const reasonOk = !reason?.required || reasonText.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? tc("defaultTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : tone === "success" ? "success" : "primary"}
            loading={busy}
            disabled={blocked != null || !typedOk || !reasonOk}
            onClick={async () => {
              setFailure(null);
              setRunning(true);
              try {
                await onConfirm({ reason: reasonText.trim() || undefined });
              } catch (error) {
                const reference = errorReference(
                  error as { digest?: string },
                );
                reportError(error, { boundary: "confirm-dialog" });
                setFailure(reference);
              } finally {
                setRunning(false);
              }
            }}
          >
            {confirmLabel ?? t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {body ? <p className="text-sm text-fg">{body}</p> : null}
        {failure ? (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {tc("failed")}{" "}
            <span className="numeric">
              {tc("failedReference", { reference: failure })}
            </span>
          </p>
        ) : null}
        {blocked ? (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {blocked}
          </p>
        ) : null}
        {blocked == null && requireTyped ? (
          <>
            <p className="text-xs text-fg-muted">{tc("irreversible")}</p>
            <TextInput
              label={tc("typeToConfirm", { word })}
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
            />
          </>
        ) : null}
        {blocked == null && reason ? (
          <TextArea
            label={reason.label}
            required={reason.required}
            value={reasonText}
            onChange={(event) => setReasonText(event.target.value)}
          />
        ) : null}
      </div>
    </Dialog>
  );
}

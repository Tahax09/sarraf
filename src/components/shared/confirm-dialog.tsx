"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextArea, TextInput } from "@/components/ui/field";

/**
 * Confirmation gate for high-stakes actions: approvals, cancellations, user
 * deactivation, role permission edits, currency/branch deletion.
 *
 * `requireTyped` adds a type-to-confirm step for the destructive/irreversible
 * end of that list.
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
  onConfirm: (input: { reason?: string }) => void;
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

  // Closing wipes the typed confirmation and the reason so the next dialog
  // never opens pre-filled. Adjusted during render rather than in an effect.
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setTyped("");
      setReasonText("");
    }
  }

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
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : tone === "success" ? "success" : "primary"}
            loading={loading}
            disabled={blocked != null || !typedOk || !reasonOk}
            onClick={() =>
              onConfirm({ reason: reasonText.trim() || undefined })
            }
          >
            {confirmLabel ?? t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {body ? <p className="text-sm text-fg">{body}</p> : null}
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

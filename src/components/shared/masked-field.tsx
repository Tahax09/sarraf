"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatIban, maskTail } from "@/lib/format";
import { useAuditLog } from "@/lib/audit";
import { cn } from "@/lib/utils";

/**
 * Mask-by-default sensitive value with reveal-and-audit-log.
 *
 * The revealed value is held only in local component state for the lifetime of
 * the panel — never persisted, never written to a URL, never logged. Revealing
 * fires an audit event naming the field and record, not the value.
 */
export function MaskedField({
  value,
  fieldName,
  subjectType,
  subjectId,
  format = "plain",
  className,
}: {
  value: string | null | undefined;
  /** Human field name used in the audit trail and the a11y label. */
  fieldName: string;
  subjectType?: string;
  subjectId?: string;
  format?: "plain" | "iban";
  className?: string;
}) {
  const t = useTranslations("masked");
  const tc = useTranslations("common");
  const audit = useAuditLog();
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className="text-fg-subtle">—</span>;

  const shown = revealed
    ? format === "iban"
      ? formatIban(value)
      : value
    : maskTail(value, 4);

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* An IBAN is grouped in fours and an account number can carry a prefix:
          the run order is part of the value, so it is pinned, not inherited. */}
      <span className="identifier break-all">{shown}</span>
      <button
        type="button"
        aria-label={
          revealed
            ? t("hideLabel", { field: fieldName })
            : t("revealLabel", { field: fieldName })
        }
        aria-pressed={revealed}
        title={revealed ? tc("hide") : tc("reveal")}
        onClick={() => {
          const next = !revealed;
          setRevealed(next);
          if (next) {
            void audit({
              event: "sensitive_field_revealed",
              field: fieldName,
              subjectType,
              subjectId,
            });
          }
        }}
        className="rounded p-1 text-fg-muted hover:bg-surface-muted hover:text-fg"
      >
        {revealed ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
      {revealed ? <span className="sr-only">{t("revealed")}</span> : null}
    </span>
  );
}

/**
 * Write-only secret input. After a value is stored the field never re-displays
 * it — a fixed placeholder plus an explicit "Replace" action is the only way
 * back into edit mode.
 */
export function SecretField({
  configured,
  value,
  onChange,
  label,
  placeholder,
}: {
  configured: boolean;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const t = useTranslations("common");
  const tCbl = useTranslations("cbl");
  const [editing, setEditing] = useState(!configured);

  if (configured && !editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2">
          <span className="numeric text-sm text-fg-muted">••••••••••••</span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setEditing(true);
            }}
            className="text-xs font-medium text-accent"
          >
            {t("replace")}
          </button>
        </div>
        <p className="text-xs text-fg-subtle">{tCbl("secretStored")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-fg-muted" htmlFor="secret-key">
        {label}
      </label>
      <input
        id="secret-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="numeric w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
      />
    </div>
  );
}

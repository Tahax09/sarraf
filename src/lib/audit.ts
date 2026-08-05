"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/api/client";

export type AuditUiEvent =
  | "sensitive_field_revealed"
  | "sensitive_field_copied"
  | "report_exported";

type AuditPayload = {
  event: AuditUiEvent;
  /** What was accessed — a field name and a record reference, never the value. */
  field?: string;
  subjectType?: string;
  subjectId?: string;
};

/**
 * Fire-and-forget audit trigger for sensitive UI actions (revealing an IBAN,
 * copying an account number, exporting a report). The value itself is never
 * sent — only what was accessed, on which record.
 */
export function useAuditLog() {
  return useCallback(async (payload: AuditPayload) => {
    try {
      await apiFetch<void>("/audit/ui-events", {
        method: "POST",
        body: { ...payload, occurredAt: new Date().toISOString() },
      });
    } catch {
      // Never block or break the UI on an audit write; the backend also logs
      // server-side for anything that touches real data.
    }
  }, []);
}

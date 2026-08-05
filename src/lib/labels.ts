"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

/**
 * Central mapping from backend enum codes to display labels.
 *
 * A raw enum value (`authorizedFundWithdrawalSettlement`, `roundingIncome`, …)
 * must never reach the screen. Anything unmapped falls back to a marked
 * "unknown" string so a gap is visible in QA instead of leaking a code.
 */
export type LabelDomain =
  | "operationType"
  | "status"
  | "ledgerEvent"
  | "feeType"
  | "accountType"
  | "userType"
  | "logLevel"
  | "continent";

export function useLabels() {
  const t = useTranslations("enums");

  const label = useCallback(
    (domain: LabelDomain, code: string | null | undefined): string => {
      if (!code) return "—";
      const key = `${domain}.${code}`;
      // next-intl throws on missing keys in dev; `has` keeps the fallback path.
      const exists = t.has(key as never);
      return exists
        ? t(key as never)
        : t("unknown", { code });
    },
    [t],
  );

  return useMemo(
    () => ({
      label,
      operationType: (code: string | null | undefined) =>
        label("operationType", code),
      status: (code: string | null | undefined) => label("status", code),
      ledgerEvent: (code: string | null | undefined) =>
        label("ledgerEvent", code),
      feeType: (code: string | null | undefined) => label("feeType", code),
      accountType: (code: string | null | undefined) =>
        label("accountType", code),
      userType: (code: string | null | undefined) => label("userType", code),
      logLevel: (code: string | null | undefined) => label("logLevel", code),
      continent: (code: string | null | undefined) => label("continent", code),
    }),
    [label],
  );
}

/** Status → badge tone, shared by every list in the app. */
export function statusTone(
  status: string,
): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (status) {
    case "confirmed":
    case "completed":
      return "success";
    case "cancelled":
    case "failed":
      return "danger";
    case "expired":
      return "warning";
    case "reserve":
    case "pending":
      return "info";
    default:
      return "neutral";
  }
}

"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { statusTone, useLabels } from "@/lib/labels";
import { formatAmount, formatDateTime, formatPhone } from "@/lib/format";
import type { Fee } from "@/lib/api/types";

/**
 * Client identity cell: name with the normalized phone underneath.
 *
 * The name is `<bdi>`: a client record may hold Arabic, Latin or both, and an
 * Arabic table must not reorder "Ahmed Al-Sharif" or push a trailing "(LLC)"
 * to the wrong end of the cell.
 */
export function ClientCell({
  name,
  phone,
}: {
  name: string;
  phone: string | null;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <bdi className="truncate text-sm text-fg">{name}</bdi>
      <span className="numeric text-xs text-fg-muted">
        {formatPhone(phone)}
      </span>
    </span>
  );
}

/**
 * Amount with an optional fee line. The fee line is omitted entirely when the
 * operation carries no fee — never a "0.000" row.
 */
export function AmountCell({
  amount,
  currency,
  fee,
  precision,
}: {
  amount: number;
  currency: string;
  fee?: Fee | null;
  precision?: number;
}) {
  const t = useTranslations("fields");
  return (
    <span className="flex flex-col items-start">
      <span className="numeric text-sm font-medium text-fg">
        {formatAmount(amount, currency, precision)}
      </span>
      {fee && fee.amount > 0 ? (
        <span className="numeric text-xs text-fg-muted">
          {t("fee")}: {formatAmount(fee.amount, fee.currency, precision)}
        </span>
      ) : null}
    </span>
  );
}

export function DateCell({ value }: { value: string }) {
  return (
    <span className="numeric text-xs text-fg-muted">
      {formatDateTime(value)}
    </span>
  );
}

/** A status as a toned badge — the same mapping everywhere it is shown. */
export function StatusCell({ status }: { status: string }) {
  const labels = useLabels();
  return <Badge tone={statusTone(status)}>{labels.status(status)}</Badge>;
}

export function PhoneText({ value }: { value: string | null }) {
  return <span className="numeric">{formatPhone(value)}</span>;
}

/**
 * Sender → Receiver, replacing six separate columns in the transfer lists.
 *
 * Both parties are isolated: the arrow between them is a neutral character, so
 * an Arabic sender beside a Latin receiver would otherwise resolve as one run
 * and swap which side of the arrow each name lands on.
 */
export function TransferCell({ from, to }: { from: ReactNode; to: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-sm text-fg">
      <bdi className="min-w-0 truncate">{from}</bdi>
      <span aria-hidden className="rtl-flip text-fg-subtle">
        →
      </span>
      <bdi className="min-w-0 truncate">{to}</bdi>
    </span>
  );
}

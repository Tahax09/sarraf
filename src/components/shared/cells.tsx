"use client";

import { useCallback, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { statusTone, useLabels } from "@/lib/labels";
import { countryFlag, formatAmount, formatDateTime, formatPhone } from "@/lib/format";
import { useCountries } from "@/lib/api/hooks";
import type { Fee } from "@/lib/api/types";

/**
 * A KYC record carries the client's full name twice — Arabic and Latin — and
 * both are the client's name, not a translation of one another. Which one leads
 * follows the page: an operator reading Arabic scans Arabic names, and the same
 * screen in English scans Latin ones.
 *
 * The other name is never dropped. It is what a passport, a SWIFT message or a
 * correspondent bank will show, and an operator matching a document against the
 * screen needs to see the form they are holding.
 */
export function clientNames(
  name: string,
  nameEn: string | null | undefined,
  locale: string,
): { primary: string; secondary: string | null } {
  // No Latin name on file — the Arabic one stands alone rather than leaving a
  // gap or an em dash where a name belongs.
  if (!nameEn) return { primary: name, secondary: null };
  return locale === "ar"
    ? { primary: name, secondary: nameEn }
    : { primary: nameEn, secondary: name };
}

/** Internal: the two cells below share it. Exported nothing — callers outside
 *  this file want `ClientNameText` or `useClientNameText`, which decide the
 *  presentation too. */
function useClientNames(name: string, nameEn?: string | null) {
  return clientNames(name, nameEn, useLocale());
}

/**
 * Picks the name that leads, for the places that can only carry one string —
 * a drawer title, an export cell, a search result line.
 */
export function useClientNameText() {
  const locale = useLocale();
  // Stable across renders: callers hold it in `useMemo` dependency lists.
  return useCallback(
    (name: string, nameEn?: string | null) =>
      clientNames(name, nameEn, locale).primary,
    [locale],
  );
}

/**
 * Both names on one line, for detail rows and summaries. The second name is
 * parenthesised rather than stacked: a detail row is a label and a value, and
 * splitting the value over two lines breaks the pairing with its label.
 */
export function ClientNameText({
  name,
  nameEn,
}: {
  name: string;
  nameEn?: string | null;
}) {
  const names = useClientNames(name, nameEn);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <bdi>{names.primary}</bdi>
      {names.secondary ? (
        <bdi className="text-xs text-fg-muted">({names.secondary})</bdi>
      ) : null}
    </span>
  );
}

/**
 * Client identity cell: the name that leads, then the other name and the
 * normalized phone on one muted line — two lines whether or not a Latin name is
 * on file, so a register does not change row height client by client.
 *
 * Every name is `<bdi>`: a client record may hold Arabic, Latin or both, and an
 * Arabic table must not reorder "Ahmed Al-Sharif" or push a trailing "(LLC)"
 * to the wrong end of the cell.
 */
export function ClientCell({
  name,
  nameEn,
  phone,
}: {
  name: string;
  nameEn?: string | null;
  phone: string | null;
}) {
  const names = useClientNames(name, nameEn);
  return (
    <span className="flex min-w-0 flex-col">
      <bdi className="truncate text-sm text-fg">{names.primary}</bdi>
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
        {names.secondary ? (
          <>
            <bdi className="truncate">{names.secondary}</bdi>
            <span aria-hidden>·</span>
          </>
        ) : null}
        <span className="identifier shrink-0">{formatPhone(phone)}</span>
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
    <span className="identifier text-xs text-fg-muted">
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
  return <span className="identifier">{formatPhone(value)}</span>;
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

/**
 * A nationality, resolved from its ISO code to the name in the reading
 * language. The register carries both spellings, so a client record stores the
 * code and the label is chosen here rather than frozen at capture time.
 *
 * The flag leads because it is the fastest thing to scan down a column, but it
 * is `aria-hidden`: a flag is not a country name, and the name follows it.
 */
export function CountryName({ code }: { code: string | null | undefined }) {
  const locale = useLocale();
  const tc = useTranslations("common");
  const countries = useCountries();

  if (!code) return <>{tc("notAvailable")}</>;

  const country = (countries.data ?? []).find((item) => item.code === code);
  // Still loading, or a code the register does not carry: the code itself is
  // more use than a dash, and it is what the backend holds.
  if (!country) return <>{code}</>;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{countryFlag(country.code)}</span>
      <bdi>{locale === "ar" ? country.name : country.nameEn}</bdi>
    </span>
  );
}

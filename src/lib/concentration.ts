import type { CurrencyBalance } from "@/lib/api/types";

/**
 * How much of the book a handful of clients account for.
 *
 * The ranking on Top clients answers "who are the biggest clients". It does not
 * answer the question a supervisor actually acts on — *how much of the money on
 * deposit is in those hands* — and the two are not the same: a table of large
 * balances looks identical whether those clients hold three per cent of the
 * book or eighty. Concentration is the figure that decides whether a single
 * withdrawal is routine or a liquidity event, and no other screen carries it.
 *
 * Both inputs already exist: the ranking (`/dashboard/top-clients`) and the
 * canonical per-currency totals behind the Dashboard's balances card
 * (`/dashboard/currency-balances`). Nothing new is fetched and nothing is
 * inferred — the denominator is the backend's own total, not a sum of the rows
 * that happen to be on screen.
 */

export type RankedHolder = {
  id: string;
  name: string;
  nameEn: string | null;
  balance: number;
  currency: string;
};

export type ConcentrationRow = {
  currency: string;
  /** How many of the ranked clients hold this currency. */
  clients: number;
  /** Their balances, added up. */
  listed: number;
  /** Every account in this currency, from the balances endpoint. */
  total: number;
  /** `listed / total`, 0–1. */
  share: number;
  largestName: string;
  largestNameEn: string | null;
  largestBalance: number;
  /** The single biggest holder's share of the same total, 0–1. */
  largestShare: number;
};

export function concentration(
  holders: readonly RankedHolder[],
  balances: readonly CurrencyBalance[],
): ConcentrationRow[] {
  const totals = new Map(balances.map((row) => [row.currency, row.total]));
  const grouped = new Map<string, RankedHolder[]>();

  for (const holder of holders) {
    // A negative or zero balance is a client who owes or holds nothing; it
    // cannot be part of a share of what is on deposit, and including it would
    // let one overdrawn account understate the concentration of the rest.
    if (holder.balance <= 0) continue;
    const group = grouped.get(holder.currency);
    if (group) group.push(holder);
    else grouped.set(holder.currency, [holder]);
  }

  const rows: ConcentrationRow[] = [];
  for (const [currency, group] of grouped) {
    const total = totals.get(currency) ?? 0;
    // Without the backend's total there is no honest denominator, and a share
    // of the rows on screen is a number about the screen. Skip the currency
    // rather than print something that reads like a fact.
    if (total <= 0) continue;

    const listed = group.reduce((sum, holder) => sum + holder.balance, 0);
    const largest = group.reduce((top, holder) =>
      holder.balance > top.balance ? holder : top,
    );

    rows.push({
      currency,
      clients: group.length,
      listed,
      total,
      share: listed / total,
      largestName: largest.name,
      largestNameEn: largest.nameEn,
      largestBalance: largest.balance,
      largestShare: largest.balance / total,
    });
  }

  // Most concentrated first: the currency where the fewest hands hold the most
  // is the one worth reading first.
  return rows.sort((a, b) => b.share - a.share);
}

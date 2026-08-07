"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ClientNameText } from "@/components/shared/cells";
import { useCurrencyBalances } from "@/lib/api/hooks";
import { concentration, type ConcentrationRow } from "@/lib/concentration";
import type { TopClient } from "@/lib/api/hooks";
import { formatAmount, formatCount, formatShare } from "@/lib/format";

/**
 * The share of the book the ranked clients hold.
 *
 * The table above this one says who the largest clients are. This says what
 * that means, which is the part a supervisor acts on: a list of big balances
 * reads the same whether those clients are three per cent of the money on
 * deposit or eighty, and only one of those is a liquidity question.
 *
 * The denominator is the backend's own per-currency total — the same figure the
 * Dashboard's balances card draws — so the percentage is a share of the book
 * and not a share of whatever happens to be on screen. A currency the balances
 * endpoint does not cover is dropped rather than shown against a made-up whole.
 */
export function ClientConcentrationCard({
  clients,
  loading,
}: {
  clients: readonly TopClient[];
  loading?: boolean;
}) {
  const t = useTranslations("topClients");
  const tf = useTranslations("fields");
  const tStats = useTranslations("stats");

  const balances = useCurrencyBalances();
  const rows = useMemo(
    () => concentration(clients, balances.data ?? []),
    [clients, balances.data],
  );

  const columns: Column<ConcentrationRow>[] = [
    {
      key: "currency",
      header: tf("currency"),
      primary: true,
      cell: (row) => <span className="numeric text-sm">{row.currency}</span>,
    },
    {
      key: "share",
      header: t("shareOfBook"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm font-medium">
          {formatShare(row.share)}
        </span>
      ),
    },
    {
      key: "clients",
      header: tStats("count"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm">{formatCount(row.clients)}</span>
      ),
    },
    {
      key: "largest",
      header: t("largestHolder"),
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <ClientNameText name={row.largestName} nameEn={row.largestNameEn} />
          <span className="numeric text-xs text-fg-muted">
            {t("largestHolderShare", {
              share: formatShare(row.largestShare),
              amount: formatAmount(row.largestBalance, row.currency),
            })}
          </span>
        </span>
      ),
    },
    {
      key: "total",
      header: tStats("total"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm">
          {formatAmount(row.total, row.currency)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title={t("concentration")}
        description={t("concentrationDescription")}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.currency}
        loading={loading || balances.isLoading}
        error={balances.isError}
        onRetry={() => balances.refetch()}
        caption={t("concentration")}
        // One row per currency the ranked clients hold — a handful, always.
        paging="none"
      />
    </Card>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { CompositionDonut } from "@/components/charts";
import { useCurrencyBalances } from "@/lib/api/hooks";
import { formatAmount, formatCount } from "@/lib/format";
import type { CurrencyBalance } from "@/lib/api/types";

/** Canonical currency balances (§7 item 4) — donut plus exact figures. */
export function CurrencyBalancesCard() {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const tStats = useTranslations("stats");
  const query = useCurrencyBalances();
  const rows = query.data ?? [];

  const columns: Column<CurrencyBalance>[] = [
    {
      key: "currency",
      header: tf("currency"),
      primary: true,
      cell: (row) => <span className="numeric text-sm">{row.currency}</span>,
    },
    {
      key: "accounts",
      header: tStats("count"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm">{formatCount(row.accounts)}</span>
      ),
    },
    {
      key: "total",
      header: tStats("total"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm font-medium">
          {formatAmount(row.total, row.currency)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader title={t("currencyBalances")} />
      <CardBody>
        <CompositionDonut
          data={rows}
          figures="adjacent"
          nameKey="currency"
          valueKey="total"
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
        />
      </CardBody>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.currency}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        caption={t("currencyShare")}
        paginate={false}
      />
    </Card>
  );
}

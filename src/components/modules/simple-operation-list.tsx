"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import {
  DetailRow,
  DetailSection,
} from "@/components/shared/detail-drawer";
import { AmountCell, ClientCell, DateCell } from "@/components/shared/cells";
import { TextInput } from "@/components/ui/field";
import { formatAmount, formatCount, formatDateTime, formatPhone } from "@/lib/format";
import { useLabels } from "@/lib/labels";
import type {
  DepositOperation,
  Paged,
  WithdrawalOperation,
} from "@/lib/api/types";

type SimpleOperation = WithdrawalOperation | DepositOperation;

/** Narrow view of a TanStack query — keeps the two callers' types compatible. */
type ListQuery = {
  data?: Paged<SimpleOperation>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
};

/**
 * List shell shared by Withdrawal and Deposit: same columns, same drawer, only
 * the amount label and register route differ.
 */
export function SimpleOperationList({
  title,
  amountLabel,
  registerHref,
  useData,
}: {
  title: string;
  amountLabel: string;
  registerHref: string;
  useData: (params: { q: string; pageSize: number }) => ListQuery;
}) {
  const t = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();
  const [q, setQ] = useState("");

  const query = useData({ q, pageSize: 100 });
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  // Fee column only exists when at least one row actually carries a fee.
  const anyFee = rows.some((row) => row.fee && row.fee.amount > 0);

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount);
    }
    return [...map.entries()];
  }, [rows]);

  const columns: Column<SimpleOperation>[] = [
    {
      key: "client",
      header: t("client"),
      primary: true,
      cell: (row) => <ClientCell name={row.clientName} phone={row.clientPhone} />,
    },
    {
      key: "account",
      header: t("accountNumber"),
      cell: (row) => <span className="numeric text-sm">{row.accountNumber}</span>,
    },
    {
      key: "amount",
      header: amountLabel,
      align: "end",
      cell: (row) => (
        <AmountCell
          amount={row.amount}
          currency={row.currency}
          fee={anyFee ? row.fee : null}
        />
      ),
    },
    {
      key: "date",
      header: t("date"),
      cell: (row) => <DateCell value={row.createdAt} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        actions={
          <Link href={registerHref} className={buttonStyles()}>
            <Plus className="size-4" aria-hidden />
            {tc("add")}
          </Link>
        }
      />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(query.data?.total ?? 0),
            numeric: true,
          },
          ...totalsByCurrency.map(([currency, total]) => ({
            label: `${tStats("total")} — ${currency}`,
            value: formatAmount(total, currency),
            numeric: true,
          })),
        ]}
      />

      <Card>
        <div className="border-b border-border p-3">
          <TextInput
            label={tc("search")}
            placeholder={tc("searchPlaceholder")}
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={title}
          detailTitle={(row) => row.clientName}
          renderDetail={(row) => (
            <>
              <DetailSection title={tc("details")}>
                {/* Raw backend IDs live here, never as a table column. */}
                <DetailRow label={t("entryId")} value={row.id} numeric />
                <DetailRow label={t("reference")} value={row.reference} numeric />
                <DetailRow label={t("type")} value={labels.operationType(row.type)} />
                <DetailRow label={t("branch")} value={row.branchName} />
                <DetailRow
                  label={t("createdAt")}
                  value={formatDateTime(row.createdAt)}
                  numeric
                />
              </DetailSection>

              <DetailSection title={t("client")}>
                <DetailRow label={t("clientName")} value={row.clientName} />
                <DetailRow
                  label={t("phone")}
                  value={formatPhone(row.clientPhone)}
                  numeric
                />
                <DetailRow
                  label={t("accountNumber")}
                  value={row.accountNumber}
                  numeric
                />
              </DetailSection>

              <DetailSection title={amountLabel}>
                <DetailRow
                  label={t("amount")}
                  value={formatAmount(row.amount, row.currency)}
                  numeric
                />
                {row.fee && row.fee.amount > 0 ? (
                  <>
                    <DetailRow
                      label={t("feeType")}
                      value={labels.feeType(row.fee.type)}
                    />
                    <DetailRow
                      label={t("fee")}
                      value={formatAmount(row.fee.amount, row.fee.currency)}
                      numeric
                    />
                    <DetailRow
                      label={t("total")}
                      value={formatAmount(row.amount + row.fee.amount, row.currency)}
                      numeric
                    />
                  </>
                ) : null}
              </DetailSection>
            </>
          )}
        />
      </Card>
    </div>
  );
}

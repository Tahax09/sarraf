"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { DateCell, TransferCell } from "@/components/shared/cells";
import { formatAmount, formatCount, formatDateTime, formatPhone } from "@/lib/format";
import { useLabels } from "@/lib/labels";
import type { OperationBase, Paged } from "@/lib/api/types";

/** Both transfer lists move funds between two accounts inside the system. */
export type TransferOperation = OperationBase & {
  receiverAccountId: string;
  receiverAccountNumber: string;
  receiverClientName: string;
  receiverClientPhone: string;
};

export function TransferList<T extends TransferOperation>({
  title,
  amountLabel,
  registerHref,
  useData,
  amountColumns,
  renderExtraDetail,
}: {
  title: string;
  amountLabel: string;
  registerHref: string;
  useData: (params: { q: string; pageSize: number }) => {
    data?: Paged<T>;
    isLoading: boolean;
    isError: boolean;
    refetch: () => unknown;
  };
  /** CEFT shows sent + converted; fund transfer shows one amount. */
  amountColumns: Column<T>[];
  renderExtraDetail?: (row: T) => ReactNode;
}) {
  const t = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();
  const [q, setQ] = useState("");

  const query = useData({ q, pageSize: 100 });
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount);
    }
    return [...map.entries()];
  }, [rows]);

  const columns: Column<T>[] = [
    {
      key: "parties",
      header: `${t("sender")} / ${t("receiver")}`,
      primary: true,
      cell: (row) => (
        <TransferCell from={row.clientName} to={row.receiverClientName} />
      ),
    },
    ...amountColumns,
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
          ...totals.map(([currency, total]) => ({
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
          detailTitle={(row) => `${row.clientName} → ${row.receiverClientName}`}
          renderDetail={(row) => (
            <>
              <DetailSection title={tc("details")}>
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

              <DetailSection title={t("sender")}>
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

              <DetailSection title={t("receiver")}>
                <DetailRow label={t("clientName")} value={row.receiverClientName} />
                <DetailRow
                  label={t("phone")}
                  value={formatPhone(row.receiverClientPhone)}
                  numeric
                />
                <DetailRow
                  label={t("accountNumber")}
                  value={row.receiverAccountNumber}
                  numeric
                />
              </DetailSection>

              <DetailSection title={amountLabel}>
                <DetailRow
                  label={amountLabel}
                  value={formatAmount(row.amount, row.currency)}
                  numeric
                />
                {row.fee && row.fee.amount > 0 ? (
                  <DetailRow
                    label={t("fee")}
                    value={formatAmount(row.fee.amount, row.fee.currency)}
                    numeric
                  />
                ) : null}
              </DetailSection>

              {renderExtraDetail?.(row)}
            </>
          )}
        />
      </Card>
    </div>
  );
}

"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Coins, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar, STAT_COLORS } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import {
  DetailRow,
  DetailSection,
} from "@/components/shared/detail-drawer";
import {
  AmountCell,
  ClientCell,
  ClientNameText,
  DateCell,
  useClientNameText,
} from "@/components/shared/cells";
import { MaskedField } from "@/components/shared/masked-field";
import { TextInput } from "@/components/ui/field";
import {
  formatAmount,
  formatCount,
  formatDateTime,
  formatPhone,
  isolate,
} from "@/lib/format";
import { useLabels } from "@/lib/labels";
import { useTableQuery } from "@/lib/use-table-query";
import type { QueryParams } from "@/lib/api/client";
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
 *
 * Paging, ordering and search are the server's job — the page asks for one page
 * at a time and reports the backend's `total`, so the register can never show a
 * truncated set as if it were complete.
 */
export function SimpleOperationList({
  title,
  amountLabel,
  registerHref,
  useData,
  showIban = false,
  statIcon,
  statColor = "var(--color-accent)",
}: {
  title: string;
  amountLabel: string;
  registerHref: string;
  useData: (params: QueryParams) => ListQuery;
  /** Icon on the record-count card — the module's own, as in the sidebar. */
  statIcon?: ReactNode;
  /** Colour of that card's icon tile. See `HeaderStat.color`. */
  statColor?: string;
  /**
   * Withdrawals are settled against the account's IBAN, so the register shows
   * it beside the account number. Deposits are taken over the counter and do
   * not need it, so the column is opt-in rather than always present.
   */
  showIban?: boolean;
}) {
  const t = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();
  const clientName = useClientNameText();

  const table = useTableQuery({
    sort: { key: "createdAt", direction: "desc" },
  });
  const query = useData(table.params);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  // Fee column only exists when at least one row actually carries a fee.
  const anyFee = rows.some((row) => row.fee && row.fee.amount > 0);

  // Sums cover the rows on screen. The backend returns no aggregate over the
  // whole result set, so the label says "page total" rather than implying a
  // register-wide figure that would be wrong.
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
      sortKey: "clientName",
      cell: (row) => (
        <ClientCell
          name={row.clientName}
          nameEn={row.clientNameEn}
          phone={row.clientPhone}
        />
      ),
    },
    {
      key: "account",
      header: t("accountNumber"),
      sortKey: "accountNumber",
      cell: (row) => <span className="numeric text-sm">{row.accountNumber}</span>,
    },
    ...(showIban
      ? [
          {
            key: "iban",
            header: t("iban"),
            // Masked in place with an audited reveal — the same control used
            // for a beneficiary IBAN in External Transfer.
            cell: (row: SimpleOperation) => (
              <MaskedField
                value={row.accountIban}
                fieldName={t("iban")}
                subjectType={row.type}
                subjectId={row.id}
                format="iban"
                className="text-sm"
              />
            ),
          } satisfies Column<SimpleOperation>,
        ]
      : []),
    {
      key: "amount",
      header: amountLabel,
      align: "end",
      sortKey: "amount",
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
      sortKey: "createdAt",
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
            value: formatCount(total),
            numeric: true,
            icon: statIcon,
            color: statColor,
          },
          ...totalsByCurrency.map(([currency, sum], index) => ({
            label: `${tStats("pageTotal")} — ${isolate(currency)}`,
            value: formatAmount(sum, currency),
            numeric: true,
            icon: <Coins className="size-4" aria-hidden />,
            color: STAT_COLORS[index % STAT_COLORS.length],
          })),
        ]}
      />

      <Card>
        <div className="border-b border-border p-3">
          <TextInput
            label={tc("search")}
            placeholder={tc("searchPlaceholder")}
            value={table.search}
            onChange={(event) => table.setSearch(event.target.value)}
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
          pagination={{
            page: table.page,
            pageSize: table.pageSize,
            total,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }}
          sort={table.sort}
          onSortChange={table.setSort}
          detailTitle={(row) => clientName(row.clientName, row.clientNameEn)}
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
                <DetailRow
                  label={t("clientName")}
                  value={
                    <ClientNameText
                      name={row.clientName}
                      nameEn={row.clientNameEn}
                    />
                  }
                />
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
                <DetailRow
                  label={t("iban")}
                  value={
                    <MaskedField
                      value={row.accountIban}
                      fieldName={t("iban")}
                      subjectType={row.type}
                      subjectId={row.id}
                      format="iban"
                    />
                  }
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

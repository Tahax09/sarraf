"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Coins, Pencil, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar, STAT_COLORS } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { ClientCell, ClientNameText } from "@/components/shared/cells";
import { MaskedField } from "@/components/shared/masked-field";
import { AccountEditDialog } from "@/components/modules/account-edit-dialog";
import { useAccounts, useBranches, useCurrencies } from "@/lib/api/hooks";
import { usePermission } from "@/lib/use-permission";
import { useLabels } from "@/lib/labels";
import { formatAmount, formatCount, formatPhone, isolate } from "@/lib/format";
import { useTableQuery } from "@/lib/use-table-query";
import { useFilters, type FilterDef } from "@/lib/filters";
import type { Account } from "@/lib/api/types";

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();
  const { can } = usePermission();
  const [editing, setEditing] = useState<Account | null>(null);

  const currencies = useCurrencies();
  const branches = useBranches();

  const filterDefs: FilterDef[] = [
    {
      key: "currency",
      type: "select",
      label: tf("currency"),
      options: (currencies.data ?? []).map((currency) => ({
        value: currency.alphabeticCode,
        label: `${isolate(currency.alphabeticCode)} — ${currency.name}`,
      })),
    },
    {
      key: "branchId",
      type: "select",
      label: tf("branch"),
      options: (branches.data ?? []).map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    },
  ];
  // Currency and branch are the operator's working context, worth keeping for
  // the session; the account-number search is not persisted.
  const filters = useFilters(filterDefs, { persistKey: "accounts" });

  // The account number search is the table's own search box; the two selects
  // are filters. Either one changing sends the reader back to page 1.
  const table = useTableQuery({
    filters: filters.params,
    sort: { key: "number", direction: "asc" },
  });
  const query = useAccounts(table.params);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  // Balances add up the rows on screen, not the whole register — the label says
  // so, because an operator reading a page sum as a register sum would be
  // reading the wrong number.
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.balance);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [rows]);

  const columns: Column<Account>[] = [
    {
      key: "number",
      header: tf("accountNumber"),
      primary: true,
      sortKey: "number",
      cell: (row) => <span className="numeric text-sm">{row.number}</span>,
    },
    {
      key: "client",
      header: tf("client"),
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
      key: "iban",
      header: tf("iban"),
      // Same treatment as a beneficiary IBAN in External Transfer: masked in
      // place, revealed one row at a time, and the reveal is audit-logged.
      cell: (row) => (
        <MaskedField
          value={row.iban}
          fieldName={tf("iban")}
          subjectType="account"
          subjectId={row.id}
          format="iban"
          className="text-sm"
        />
      ),
    },
    {
      key: "type",
      header: tf("accountType"),
      cell: (row) => labels.accountType(row.type),
    },
    {
      key: "branch",
      header: tf("branch"),
      cell: (row) => row.branchName,
    },
    {
      key: "balance",
      header: tf("balance"),
      align: "end",
      sortKey: "balance",
      cell: (row) => (
        <span className="numeric text-sm font-medium text-fg">
          {formatAmount(row.balance, row.currency)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(total),
            numeric: true,
            icon: <Wallet className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
          ...totals.map(([currency, sum], index) => ({
            label: `${tStats("pageTotal")} — ${isolate(currency)}`,
            value: formatAmount(sum, currency),
            numeric: true,
            icon: <Coins className="size-4" aria-hidden />,
            color: STAT_COLORS[index % STAT_COLORS.length],
          })),
        ]}
      />

      <Card>
        <FilterBar
          defs={filterDefs}
          state={filters}
          search={table.search}
          onSearchChange={table.setSearch}
        />

        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("title")}
          pagination={{
            page: table.page,
            pageSize: table.pageSize,
            total,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }}
          sort={table.sort}
          onSortChange={table.setSort}
          detailTitle={(row) => row.number}
          detailFooter={(row, close) => (
            <>
              <Link
                href={`/core/accounts/${row.id}`}
                className={buttonStyles({ variant: "secondary" })}
              >
                {tc("viewFull")}
              </Link>
              {can("accounts", "create") ? (
                <Button
                  onClick={() => {
                    close();
                    setEditing(row);
                  }}
                >
                  <Pencil className="size-4" aria-hidden />
                  {tc("edit")}
                </Button>
              ) : null}
            </>
          )}
          renderDetail={(row) => (
            <>
              <DetailSection title={tc("details")}>
                <DetailRow label={tf("entryId")} value={row.id} numeric />
                <DetailRow
                  label={tf("accountNumber")}
                  value={row.number}
                  numeric
                />
                <DetailRow
                  label={tf("iban")}
                  value={
                    <MaskedField
                      value={row.iban}
                      fieldName={tf("iban")}
                      subjectType="account"
                      subjectId={row.id}
                      format="iban"
                    />
                  }
                />
                <DetailRow
                  label={tf("accountType")}
                  value={labels.accountType(row.type)}
                />
                <DetailRow label={tf("currency")} value={row.currency} />
                <DetailRow
                  label={tf("balance")}
                  value={formatAmount(row.balance, row.currency)}
                  numeric
                />
                <DetailRow label={tf("branch")} value={row.branchName} />
              </DetailSection>

              <DetailSection title={tf("client")}>
                <DetailRow
                  label={tf("clientName")}
                  value={
                    <ClientNameText name={row.clientName} nameEn={row.clientNameEn} />
                  }
                />
                <DetailRow
                  label={tf("phone")}
                  value={formatPhone(row.clientPhone)}
                  identifier
                />
              </DetailSection>
            </>
          )}
        />
      </Card>

      <AccountEditDialog
        account={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

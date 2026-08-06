"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import {
  ClientNameText,
  PhoneText,
  useClientNameText,
} from "@/components/shared/cells";
import { useAccounts, useClients } from "@/lib/api/hooks";
import { formatAmount, formatCount, formatDateTime, formatPhone } from "@/lib/format";
import { useTableQuery } from "@/lib/use-table-query";
import { useFilters, type FilterDef } from "@/lib/filters";
import type { Client } from "@/lib/api/types";

export default function ClientsPage() {
  const t = useTranslations("clients");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const clientName = useClientNameText();

  const filterDefs: FilterDef[] = [
    { key: "name", type: "text", label: t("filterByName") },
    { key: "phone", type: "text", label: t("filterByPhone") },
    { key: "email", type: "text", label: t("filterByEmail") },
  ];
  // Deliberately not persisted: every value here is personal data — a client
  // name, a phone, an email — and none of it belongs in web storage.
  const filters = useFilters(filterDefs);

  // The register filters and pages on the server; the three inputs are filters,
  // so changing any of them starts again at page 1.
  const table = useTableQuery({
    filters: filters.params,
    searchable: false,
    sort: { key: "name", direction: "asc" },
  });
  const query = useClients(table.params);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  const columns: Column<Client>[] = [
    {
      key: "name",
      header: tf("name"),
      primary: true,
      sortKey: "name",
      cell: (row) => <ClientNameText name={row.name} nameEn={row.nameEn} />,
    },
    {
      key: "phone",
      header: tf("phone"),
      sortKey: "phone",
      cell: (row) => <PhoneText value={row.phone} />,
    },
    {
      key: "email",
      header: tf("email"),
      cell: (row) => row.email ?? tc("notAvailable"),
    },
    {
      key: "accounts",
      header: t("title"),
      align: "end",
      sortKey: "accountsCount",
      cell: (row) => (
        <span className="numeric text-sm">{formatCount(row.accountsCount)}</span>
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
          },
        ]}
      />

      <Card>
        <FilterBar defs={filterDefs} state={filters} />

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
          detailTitle={(row) => clientName(row.name, row.nameEn)}
          renderDetail={(row) => {
            return (
              <>
                <DetailSection title={tc("details")}>
                  <DetailRow label={tf("entryId")} value={row.id} numeric />
                  <DetailRow label={tf("name")} value={row.name} />
                  <DetailRow
                    label={tf("nameEn")}
                    value={row.nameEn ?? tc("notAvailable")}
                  />
                  <DetailRow
                    label={tf("phone")}
                    value={formatPhone(row.phone)}
                    numeric
                  />
                  <DetailRow
                    label={tf("email")}
                    value={row.email ?? tc("notAvailable")}
                  />
                  <DetailRow
                    label={tf("createdAt")}
                    value={formatDateTime(row.createdAt)}
                    numeric
                  />
                </DetailSection>

                <ClientAccounts clientId={row.id} />
              </>
            );
          }}
        />
      </Card>
    </div>
  );
}

/**
 * The opened client's accounts, fetched when the drawer mounts. Asking for one
 * client's accounts beats pulling the whole account register up front and
 * filtering it in the browser.
 */
function ClientAccounts({ clientId }: { clientId: string }) {
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const query = useAccounts({ clientId, pageSize: 50 });
  const accounts = query.data?.items ?? [];

  return (
    <DetailSection title={tf("account")}>
      {query.isLoading ? (
        <DetailRow label={tf("account")} value={tc("loading")} />
      ) : accounts.length === 0 ? (
        <DetailRow label={tf("account")} value={tc("empty")} />
      ) : (
        accounts.map((account) => (
          <DetailRow
            key={account.id}
            label={account.number}
            value={formatAmount(account.balance, account.currency)}
            numeric
          />
        ))
      )}
    </DetailSection>
  );
}

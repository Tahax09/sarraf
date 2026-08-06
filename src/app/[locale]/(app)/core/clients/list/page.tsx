"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Users, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import {
  ClientNameText,
  CountryName,
  PhoneText,
  useClientNameText,
} from "@/components/shared/cells";
import { ClientEditDialog } from "@/components/modules/client-edit-dialog";
import { useAccounts, useClients } from "@/lib/api/hooks";
import { usePermission } from "@/lib/use-permission";
import { formatAmount, formatCount, formatDateTime, formatPhone } from "@/lib/format";
import { useTableQuery } from "@/lib/use-table-query";
import { useFilters, type FilterDef } from "@/lib/filters";
import type { Client } from "@/lib/api/types";

export default function ClientsPage() {
  const t = useTranslations("clients");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const ts = useTranslations("sections");
  const clientName = useClientNameText();
  const { can } = usePermission();
  const [editing, setEditing] = useState<Client | null>(null);

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
  // Rows on screen, not the whole register — the backend publishes no aggregate
  // over the result set, and the label says "page" for that reason.
  const pageAccounts = useMemo(
    () => rows.reduce((sum, row) => sum + row.accountsCount, 0),
    [rows],
  );

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
            icon: <Users className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
          {
            // Accounts held by the clients on this page — the register's own
            // count answers "how many clients", not "how much banking".
            label: tStats("pageAccounts"),
            value: formatCount(pageAccounts),
            numeric: true,
            icon: <Wallet className="size-4" aria-hidden />,
            color: "var(--color-chart-deposit)",
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
          detailFooter={(row, close) => (
            <>
              <Link
                href={`/core/clients/${row.id}`}
                className={buttonStyles({ variant: "secondary" })}
              >
                {tc("viewFull")}
              </Link>
              {can("clients", "create") ? (
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
          /*
           * Three sections rather than one list of everything. A drawer opened
           * from a register is answering one of three questions — is this the
           * right person, how do I reach them, what is on file — and grouping
           * the rows that way is faster to scan than a flat run of labels.
           *
           * Both names get their own row. They are not a translation of one
           * another: one is what the identity document says and the other is
           * what a SWIFT message or a correspondent bank will show, and an
           * operator matching a document against the screen needs to see the
           * form they are holding, not whichever one the page's language picked.
           */
          renderDetail={(row) => (
            <>
              <DetailSection title={ts("identity")}>
                <DetailRow label={tf("nameAr")} value={row.name} />
                <DetailRow
                  label={tf("nameEn")}
                  value={row.nameEn ?? tc("notAvailable")}
                />
                <DetailRow
                  label={tf("nationality")}
                  value={<CountryName code={row.nationalityCode} />}
                />
              </DetailSection>

              <DetailSection title={ts("contactInformation")}>
                <DetailRow
                  label={tf("phone")}
                  value={formatPhone(row.phone)}
                  identifier
                />
                <DetailRow
                  label={tf("email")}
                  value={row.email ?? tc("notAvailable")}
                  identifier={Boolean(row.email)}
                />
                <DetailRow
                  label={tf("address")}
                  value={row.address ?? tc("notAvailable")}
                />
              </DetailSection>

              <DetailSection title={ts("recordInformation")}>
                <DetailRow label={tf("entryId")} value={row.id} identifier />
                <DetailRow
                  label={tf("createdAt")}
                  value={formatDateTime(row.createdAt)}
                  identifier
                />
                <DetailRow
                  label={ts("accounts")}
                  value={formatCount(row.accountsCount)}
                  numeric
                />
              </DetailSection>

              <ClientAccounts clientId={row.id} />
            </>
          )}
        />
      </Card>

      <ClientEditDialog
        client={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
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

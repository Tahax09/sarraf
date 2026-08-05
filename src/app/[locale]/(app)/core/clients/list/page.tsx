"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { PhoneText } from "@/components/shared/cells";
import { useAccounts, useClients } from "@/lib/api/hooks";
import { formatAmount, formatCount, formatDateTime, formatPhone } from "@/lib/format";
import type { Client } from "@/lib/api/types";

export default function ClientsPage() {
  const t = useTranslations("clients");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");

  const [filters, setFilters] = useState({ name: "", email: "", phone: "" });
  const query = useClients({ ...filters, pageSize: 100 });
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  // Loaded once and reused for every drawer instead of a fetch per row.
  const accounts = useAccounts({ pageSize: 500 });

  const columns: Column<Client>[] = [
    { key: "name", header: tf("name"), primary: true, cell: (row) => row.name },
    {
      key: "phone",
      header: tf("phone"),
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
      cell: (row) => (
        <span className="numeric text-sm">{formatCount(row.accountsCount)}</span>
      ),
    },
  ];

  const anyFilter = Object.values(filters).some((value) => value !== "");

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(query.data?.total ?? 0),
            numeric: true,
          },
        ]}
      />

      <Card>
        <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-3">
          <TextInput
            label={t("filterByName")}
            value={filters.name}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <TextInput
            label={t("filterByPhone")}
            numeric
            inputMode="tel"
            value={filters.phone}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, phone: event.target.value }))
            }
          />
          <TextInput
            label={t("filterByEmail")}
            type="email"
            value={filters.email}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, email: event.target.value }))
            }
          />
          {anyFilter ? (
            <div className="sm:col-span-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ name: "", email: "", phone: "" })}
              >
                {tc("clearFilters")}
              </Button>
            </div>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("title")}
          detailTitle={(row) => row.name}
          renderDetail={(row) => {
            const clientAccounts = (accounts.data?.items ?? []).filter(
              (account) => account.clientId === row.id,
            );
            return (
              <>
                <DetailSection title={tc("details")}>
                  <DetailRow label={tf("entryId")} value={row.id} numeric />
                  <DetailRow label={tf("name")} value={row.name} />
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

                <DetailSection title={tf("account")}>
                  {clientAccounts.length === 0 ? (
                    <DetailRow label={tf("account")} value={tc("empty")} />
                  ) : (
                    clientAccounts.map((account) => (
                      <DetailRow
                        key={account.id}
                        label={account.number}
                        value={formatAmount(account.balance, account.currency)}
                        numeric
                      />
                    ))
                  )}
                </DetailSection>
              </>
            );
          }}
        />
      </Card>
    </div>
  );
}

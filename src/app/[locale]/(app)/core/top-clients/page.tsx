"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { ClientCell } from "@/components/shared/cells";
import { useTopClients, type TopClient } from "@/lib/api/hooks";
import { formatAmount, formatCount, formatDate } from "@/lib/format";

type Mode = "balance" | "activity";

export default function TopClientsPage() {
  const t = useTranslations("topClients");
  const tf = useTranslations("fields");
  const tStats = useTranslations("stats");

  const [mode, setMode] = useState<Mode>("balance");
  const query = useTopClients(mode);
  const rows = query.data ?? [];

  const columns: Column<TopClient>[] = [
    {
      key: "client",
      header: tf("client"),
      primary: true,
      cell: (row) => <ClientCell name={row.name} phone={row.phone} />,
    },
    {
      key: "balance",
      header: tf("balance"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm font-medium">
          {formatAmount(row.balance, row.currency)}
        </span>
      ),
    },
    {
      key: "operations",
      header: t("operationsCount"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm">{formatCount(row.operations)}</span>
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
            value: formatCount(rows.length),
            numeric: true,
          },
          {
            label: t("operationsCount"),
            value: formatCount(
              rows.reduce((sum, row) => sum + row.operations, 0),
            ),
            numeric: true,
          },
        ]}
      />

      <Card>
        <Tabs<Mode>
          items={[
            { value: "balance", label: t("byBalance") },
            { value: "activity", label: t("byActivity") },
          ]}
          value={mode}
          onChange={setMode}
          ariaLabel={t("title")}
        />
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("title")}
          // Fixed-length ranking: no page-size control, but keep the rank number.
          paginate={false}
          numbered
          detailTitle={(row) => row.name}
          renderDetail={(row) => (
            <DetailSection title={tf("client")}>
              {/* Raw backend id belongs here, never in a visible column (§7). */}
              <DetailRow label={tf("clientId")} value={row.id} numeric />
              <DetailRow label={tf("phone")} value={row.phone} numeric />
              <DetailRow label={tf("email")} value={row.email} />
              <DetailRow
                label={tf("createdAt")}
                value={formatDate(row.createdAt)}
                numeric
              />
              <DetailRow
                label={tf("balance")}
                value={formatAmount(row.balance, row.currency)}
                numeric
              />
            </DetailSection>
          )}
        />
      </Card>
    </div>
  );
}

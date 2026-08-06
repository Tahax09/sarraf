"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useClientNameText } from "@/components/shared/cells";
import { useRecentOperations, useTopClients } from "@/lib/api/hooks";
import type { TopClient } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatAmount, formatDateTime } from "@/lib/format";
import type { LedgerEntry } from "@/lib/api/types";

/**
 * The two "first few rows, then go to the register" cards at the foot of the
 * Dashboard. Both are previews by design: the full lists live on their own
 * routes, so neither paginates and neither sorts.
 */
function PreviewCard({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}) {
  const t = useTranslations("dashboard");
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Link
            href={href}
            className={buttonStyles({ variant: "link", className: "-me-1 text-xs" })}
          >
            {t("viewAll")}
          </Link>
        }
      />
      {children}
    </Card>
  );
}

export function TopClientsCard() {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const clientName = useClientNameText();
  const query = useTopClients("balance");

  const columns: Column<TopClient>[] = [
    {
      key: "name",
      header: tf("name"),
      primary: true,
      cell: (row) => <bdi className="truncate">{clientName(row.name, row.nameEn)}</bdi>,
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
  ];

  return (
    <PreviewCard title={t("topClientsPreview")} href="/core/top-clients">
      <DataTable<TopClient>
        columns={columns}
        // Preview only — the full list lives on /core/top-clients.
        rows={(query.data ?? []).slice(0, 6)}
        getRowId={(row) => row.id}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        caption={t("topClientsPreview")}
        paginate={false}
      />
    </PreviewCard>
  );
}

export function RecentOperationsCard() {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const labels = useLabels();
  const clientName = useClientNameText();
  const query = useRecentOperations();

  const columns: Column<LedgerEntry>[] = [
    {
      key: "client",
      header: tf("client"),
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <bdi className="truncate text-sm">
            {clientName(row.clientName, row.clientNameEn)}
          </bdi>
          <span className="text-xs text-fg-muted">
            {labels.operationType(row.type)}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: tf("amount"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm font-medium">
          {formatAmount(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: tf("date"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-xs text-fg-muted">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <PreviewCard
      title={t("recentTransactions")}
      href="/core/analytics/all-operations"
    >
      <DataTable
        columns={columns}
        rows={(query.data ?? []).slice(0, 8)}
        getRowId={(row) => row.id}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        caption={t("recentTransactions")}
        paginate={false}
      />
    </PreviewCard>
  );
}

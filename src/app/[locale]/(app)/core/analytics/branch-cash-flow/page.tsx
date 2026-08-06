"use client";

import { useTranslations } from "next-intl";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ListOrdered,
  Scale,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ExportActions } from "@/components/shared/export-actions";
import { CategoryBarChart } from "@/components/charts";
import { useBranchFlow } from "@/lib/api/hooks";
import { formatCount, formatNumber } from "@/lib/format";
import type { BranchFlow } from "@/lib/api/types";

/** §6.7 — category comparison across branches: bar chart + exact figures. */
export default function BranchCashFlowPage() {
  const t = useTranslations("analytics");
  const tf = useTranslations("fields");
  const tStats = useTranslations("stats");
  const ts = useTranslations("sections");
  const tDashboard = useTranslations("dashboard");

  const query = useBranchFlow();
  const rows = query.data ?? [];

  const totals = rows.reduce(
    (acc, row) => ({
      operations: acc.operations + row.operations,
      deposits: acc.deposits + row.deposits,
      withdrawals: acc.withdrawals + row.withdrawals,
      netFlow: acc.netFlow + row.netFlow,
    }),
    { operations: 0, deposits: 0, withdrawals: 0, netFlow: 0 },
  );

  const columns: Column<BranchFlow>[] = [
    {
      key: "branch",
      header: tf("branch"),
      primary: true,
      sortKey: "branchName",
      cell: (row) => row.branchName,
    },
    {
      key: "operations",
      header: tStats("count"),
      align: "end",
      sortKey: true,
      cell: (row) => (
        <span className="numeric text-sm">{formatCount(row.operations)}</span>
      ),
    },
    {
      key: "deposits",
      header: tDashboard("trendDeposits"),
      align: "end",
      sortKey: true,
      cell: (row) => (
        <span className="numeric text-sm">{formatNumber(row.deposits, 0)}</span>
      ),
    },
    {
      key: "withdrawals",
      header: tDashboard("trendWithdrawals"),
      align: "end",
      sortKey: true,
      cell: (row) => (
        <span className="numeric text-sm">
          {formatNumber(row.withdrawals, 0)}
        </span>
      ),
    },
    {
      key: "netFlow",
      header: tStats("netFlow"),
      align: "end",
      sortKey: true,
      cell: (row) => (
        <span
          className={
            row.netFlow < 0
              ? "numeric text-sm font-medium text-danger"
              : "numeric text-sm font-medium text-success"
          }
        >
          {formatNumber(row.netFlow, 0)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("branchCashFlowTitle")}
        actions={
          <ExportActions
            filename="branch-cash-flow"
            title={t("branchCashFlowTitle")}
            print={false}
            rows={rows}
            columns={[
              { header: tf("branch"), value: (row) => row.branchName, width: 28 },
              {
                header: tStats("count"),
                value: (row) => row.operations,
                type: "number",
                format: "#,##0",
              },
              {
                header: tDashboard("trendDeposits"),
                value: (row) => row.deposits,
                type: "number",
              },
              {
                header: tDashboard("trendWithdrawals"),
                value: (row) => row.withdrawals,
                type: "number",
              },
              {
                header: tStats("netFlow"),
                value: (row) => row.netFlow,
                type: "number",
              },
            ]}
          />
        }
      />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(totals.operations),
            numeric: true,
            icon: <ListOrdered className="size-4" aria-hidden />,
            color: "var(--color-accent)",
            // Every movement this page adds up, in the register that lists them
            // one by one.
            href: "/core/analytics/all-operations",
            module: "analytics",
          },
          {
            label: tDashboard("trendDeposits"),
            value: formatNumber(totals.deposits, 0),
            numeric: true,
            tone: "success",
            icon: <ArrowDownToLine className="size-4" aria-hidden />,
            href: "/core/analytics/all-operations?type=deposit",
            module: "analytics",
          },
          {
            label: tDashboard("trendWithdrawals"),
            value: formatNumber(totals.withdrawals, 0),
            numeric: true,
            tone: "danger",
            icon: <ArrowUpFromLine className="size-4" aria-hidden />,
            href: "/core/analytics/all-operations?type=withdrawal",
            module: "analytics",
          },
          {
            label: tStats("netFlow"),
            value: formatNumber(totals.netFlow, 0),
            numeric: true,
            tone: totals.netFlow < 0 ? "danger" : "success",
            icon: <Scale className="size-4" aria-hidden />,
          },
        ]}
      />

      <Card>
        <CardHeader title={t("branchComparison")} />
        <CardBody>
          <CategoryBarChart
            data={rows}
            figures="adjacent"
            xKey="branchName"
            series={[
              {
                key: "deposits",
                label: tDashboard("trendDeposits"),
                color: "var(--color-chart-deposit)",
              },
              {
                key: "withdrawals",
                label: tDashboard("trendWithdrawals"),
                color: "var(--color-chart-withdrawal)",
              },
            ]}
            loading={query.isLoading}
            error={query.isError}
            onRetry={() => query.refetch()}
          />
        </CardBody>
      </Card>

      {/* The chart's own figures, in their own card. A table sharing the chart's
          panel reads as part of the drawing; separated, it is what it is — the
          exact numbers, for anyone the bars do not serve. */}
      <Card>
        <CardHeader title={ts("figures")} description={t("branchComparison")} />
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.branchId}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("branchComparison")}
        />
      </Card>
    </div>
  );
}

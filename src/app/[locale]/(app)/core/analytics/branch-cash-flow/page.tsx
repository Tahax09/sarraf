"use client";

import { useTranslations } from "next-intl";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { CategoryBarChart } from "@/components/charts";
import { useBranchFlow } from "@/lib/api/hooks";
import { downloadCsv } from "@/lib/export";
import { formatCount, formatNumber } from "@/lib/format";
import type { BranchFlow } from "@/lib/api/types";

/** §6.7 — category comparison across branches: bar chart + exact figures. */
export default function BranchCashFlowPage() {
  const t = useTranslations("analytics");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
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
      cell: (row) => row.branchName,
    },
    {
      key: "operations",
      header: tStats("count"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm">{formatCount(row.operations)}</span>
      ),
    },
    {
      key: "deposits",
      header: tDashboard("trendDeposits"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm">{formatNumber(row.deposits, 0)}</span>
      ),
    },
    {
      key: "withdrawals",
      header: tDashboard("trendWithdrawals"),
      align: "end",
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
          <Button
            variant="secondary"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                "branch-cash-flow",
                [
                  tf("branch"),
                  tStats("count"),
                  tDashboard("trendDeposits"),
                  tDashboard("trendWithdrawals"),
                  tStats("netFlow"),
                ],
                rows.map((row) => [
                  row.branchName,
                  row.operations,
                  row.deposits,
                  row.withdrawals,
                  row.netFlow,
                ]),
              )
            }
          >
            <FileDown className="size-4" aria-hidden />
            {tc("exportExcel")}
          </Button>
        }
      />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(totals.operations),
            numeric: true,
          },
          {
            label: tDashboard("trendDeposits"),
            value: formatNumber(totals.deposits, 0),
            numeric: true,
            tone: "success",
          },
          {
            label: tDashboard("trendWithdrawals"),
            value: formatNumber(totals.withdrawals, 0),
            numeric: true,
            tone: "danger",
          },
          {
            label: tStats("netFlow"),
            value: formatNumber(totals.netFlow, 0),
            numeric: true,
            tone: totals.netFlow < 0 ? "danger" : "success",
          },
        ]}
      />

      <Card>
        <CardHeader title={t("branchComparison")} />
        <CardBody>
          {query.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <CategoryBarChart
              data={rows as unknown as Record<string, unknown>[]}
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
            />
          )}
        </CardBody>
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

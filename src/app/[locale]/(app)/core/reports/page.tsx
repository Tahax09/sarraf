"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { CompositionDonut, TrendAreaChart } from "@/components/charts";
import { useReport } from "@/lib/api/hooks";
import { downloadCsv, printToPdf } from "@/lib/export";
import { formatCount, formatDate, formatNumber } from "@/lib/format";
import type { BranchFlow, ReportSnapshot } from "@/lib/api/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * In / out / net for the selected date. The bars are proportional to the larger
 * of the two sides, so the gap between them reads at a glance.
 */
function CashFlowCard({ totals }: { totals: BranchFlow }) {
  const t = useTranslations("reports");
  const tStats = useTranslations("stats");
  const peak = Math.max(totals.deposits, totals.withdrawals, 1);
  const negative = totals.netFlow < 0;

  const sides = [
    { key: "in", label: t("inflow"), value: totals.deposits, color: "var(--color-success-strong)" },
    { key: "out", label: t("outflow"), value: totals.withdrawals, color: "var(--color-danger)" },
  ];

  return (
    <Card>
      <CardHeader title={t("cashFlow")} />
      <CardBody className="space-y-3">
        {sides.map((side) => (
          <div key={side.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs text-fg-muted">
              <span>{side.label}</span>
              <span className="numeric text-sm font-medium text-fg">
                {formatNumber(side.value, 0)}
              </span>
            </div>
            {/* Decorative: the figure beside it carries the same value. */}
            <div aria-hidden className="h-2 rounded-full bg-surface-muted">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${(side.value / peak) * 100}%`,
                  backgroundColor: side.color,
                }}
              />
            </div>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-fg-muted">{tStats("netFlow")}</span>
          <span
            className={
              negative
                ? "numeric text-lg font-semibold text-danger"
                : "numeric text-lg font-semibold text-success"
            }
          >
            {formatNumber(totals.netFlow, 0)}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

/** The day's currency mix by operation count — composition, so a donut. */
function CurrencyMixCard({ mix }: { mix: ReportSnapshot["currencyMix"] }) {
  const t = useTranslations("reports");
  return (
    <Card>
      <CardHeader title={t("currencyMix")} />
      <CardBody>
        <CompositionDonut
          data={mix as unknown as Record<string, unknown>[]}
          nameKey="currency"
          valueKey="operations"
          legend="side"
          height={200}
        />
      </CardBody>
    </Card>
  );
}

/**
 * Seven days of net flow ending on the selected date — enough context to tell
 * an unusual day from a normal one, without duplicating the Dashboard's trend.
 */
function TrailingCard({ trailing }: { trailing: ReportSnapshot["trailing"] }) {
  const t = useTranslations("reports");
  const points = trailing.map((point, index) => ({
    ...point,
    day: index + 1,
    fullDate: formatDate(point.date),
  }));
  const dateForDay = new Map(points.map((p) => [p.day, p.fullDate]));

  return (
    <Card>
      <CardHeader
        title={t("trailingNet")}
        description={t("trailingSeven", {
          date: formatDate(trailing[trailing.length - 1]?.date ?? ""),
        })}
      />
      <CardBody>
        <TrendAreaChart
          data={points}
          xKey="day"
          dataKey="netFlow"
          color="var(--color-accent)"
          height={200}
          tooltipLabel={(value) => dateForDay.get(Number(value)) ?? String(value)}
        />
      </CardBody>
    </Card>
  );
}

/**
 * §6.6 — a snapshot for one date, broken down per branch, with date-scoped
 * visuals around it. Deliberately carries no rolling 30-day trend: that lives
 * on the Dashboard only (§7 item 3).
 */
export default function ReportsPage() {
  const t = useTranslations("reports");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const tAnalytics = useTranslations("analytics");
  const tDashboard = useTranslations("dashboard");

  const [date, setDate] = useState(today);
  const query = useReport(date);
  const branches = query.data?.branches ?? [];
  const totals = query.data?.totals;

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

  function exportExcel() {
    downloadCsv(
      `report-${date}`,
      [
        tf("branch"),
        tStats("count"),
        tDashboard("trendDeposits"),
        tDashboard("trendWithdrawals"),
        tStats("netFlow"),
      ],
      branches.map((row) => [
        row.branchName,
        row.operations,
        row.deposits,
        row.withdrawals,
        row.netFlow,
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={
          query.data ? t("snapshotFor", { date: formatDate(date) }) : undefined
        }
        actions={
          <div className="print:hidden flex gap-2">
            <Button
              variant="secondary"
              onClick={exportExcel}
              disabled={branches.length === 0}
            >
              <FileDown className="size-4" aria-hidden />
              {tc("exportExcel")}
            </Button>
            <Button
              variant="secondary"
              onClick={printToPdf}
              disabled={branches.length === 0}
            >
              <Printer className="size-4" aria-hidden />
              {tc("exportPdf")}
            </Button>
          </div>
        }
      />

      <Card className="print:hidden">
        <div className="p-3 sm:max-w-xs">
          <TextInput
            label={t("pickDate")}
            type="date"
            numeric
            max={today()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </Card>

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(totals?.operations ?? 0),
            numeric: true,
          },
          {
            label: tDashboard("trendDeposits"),
            value: formatNumber(totals?.deposits ?? 0, 0),
            numeric: true,
            tone: "success",
          },
          {
            label: tDashboard("trendWithdrawals"),
            value: formatNumber(totals?.withdrawals ?? 0, 0),
            numeric: true,
            tone: "danger",
          },
          {
            label: tStats("netFlow"),
            value: formatNumber(totals?.netFlow ?? 0, 0),
            numeric: true,
            tone: (totals?.netFlow ?? 0) < 0 ? "danger" : "success",
          },
        ]}
      />

      {query.data && totals ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <CashFlowCard totals={totals} />
          <CurrencyMixCard mix={query.data.currencyMix} />
          <TrailingCard trailing={query.data.trailing} />
        </div>
      ) : null}

      <Card>
        <CardHeader
          title={t("perBranch")}
          description={tAnalytics("branchComparison")}
        />
        <DataTable
          columns={columns}
          rows={branches}
          getRowId={(row) => row.branchId}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          emptyTitle={t("noData")}
          caption={t("perBranch")}
        />
      </Card>
    </div>
  );
}

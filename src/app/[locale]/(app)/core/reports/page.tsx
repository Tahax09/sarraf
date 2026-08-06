"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  ListOrdered,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ExportActions } from "@/components/shared/export-actions";
import { CompositionDonut, TrendAreaChart } from "@/components/charts";
import { useReport } from "@/lib/api/hooks";
import { formatCount, formatDate, formatNumber } from "@/lib/format";
import type { BranchFlow, ReportSnapshot } from "@/lib/api/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** `days` away from an ISO date, staying on the calendar rather than on ms. */
function shiftDate(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/**
 * The date this page is about, and the two ways an operator moves it.
 *
 * The picker alone was not enough. Reading a day of business means comparing it
 * with the one before — the question is "was yesterday like this?" — and on a
 * phone that meant opening the native date picker twice for a one-day step.
 * The arrows do that step; "today" comes back from wherever the reader wandered.
 *
 * Stepping forward stops at today. There is no report for tomorrow, and a date
 * input that accepts one only produces an empty page.
 */
function DateToolbar({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const t = useTranslations("reports");
  const now = today();
  return (
    <Card className="print:hidden">
      <CardBody className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 sm:max-w-xs">
          <TextInput
            label={t("pickDate")}
            type="date"
            numeric
            max={now}
            value={date}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            aria-label={t("previousDay")}
            onClick={() => onChange(shiftDate(date, -1))}
          >
            <ArrowLeft className="rtl-flip size-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            aria-label={t("nextDay")}
            disabled={date >= now}
            onClick={() => onChange(shiftDate(date, 1))}
          >
            <ArrowRight className="rtl-flip size-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            disabled={date === now}
            onClick={() => onChange(now)}
          >
            {t("today")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
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
    {
      key: "in",
      label: t("inflow"),
      value: totals.deposits,
      color: "var(--color-success-strong)",
    },
    {
      key: "out",
      label: t("outflow"),
      value: totals.withdrawals,
      color: "var(--color-danger)",
    },
  ];

  return (
    <Card>
      {/* Each card in this row says what it draws, not what day it draws: the
          date is stated once, in the page header above them. */}
      <CardHeader
        title={t("cashFlow")}
        description={t("cashFlowDescription")}
      />
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
      <CardHeader
        title={t("currencyMix")}
        description={t("currencyMixDescription")}
      />
      <CardBody>
        <CompositionDonut
          data={mix}
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
          label={t("trailingNet")}
          color="var(--color-accent)"
          height={200}
          tooltipLabel={(value) =>
            dateForDay.get(Number(value)) ?? String(value)
          }
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
        title={t("title")}
        description={
          /*
           * Two lines, and they answer different questions. The first separates
           * this page from Analytics, which is the confusion it kept causing:
           * both show branches and cash flow, and only one of them is a document
           * you file. The second names the day, and prints — the picker above
           * does not.
           */
          <>
            {t("purpose")}
            {query.data ? (
              <span className="mt-0.5 block">
                {t("snapshotFor", { date: formatDate(date) })}
              </span>
            ) : null}
          </>
        }
        actions={
          <ExportActions
            filename={`report-${date}`}
            title={t("title")}
            sheetName={t("perBranch")}
            meta={[t("snapshotFor", { date: formatDate(date) })]}
            rows={branches}
            columns={[
              {
                header: tf("branch"),
                value: (row) => row.branchName,
                width: 28,
              },
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

      <DateToolbar date={date} onChange={setDate} />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(totals?.operations ?? 0),
            numeric: true,
            icon: <ListOrdered className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
          {
            label: tDashboard("trendDeposits"),
            value: formatNumber(totals?.deposits ?? 0, 0),
            numeric: true,
            tone: "success",
            icon: <ArrowDownToLine className="size-4" aria-hidden />,
          },
          {
            label: tDashboard("trendWithdrawals"),
            value: formatNumber(totals?.withdrawals ?? 0, 0),
            numeric: true,
            tone: "danger",
            icon: <ArrowUpFromLine className="size-4" aria-hidden />,
          },
          {
            label: tStats("netFlow"),
            value: formatNumber(totals?.netFlow ?? 0, 0),
            numeric: true,
            tone: (totals?.netFlow ?? 0) < 0 ? "danger" : "success",
            icon: <Scale className="size-4" aria-hidden />,
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
          // One row per branch, on a document that is printed and exported whole.
          paging="none"
          numbered
        />
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import {
  ChartLegendSwatch,
  CompositionDonut,
  TrendAreaChart,
} from "@/components/charts";
import {
  useCurrencyBalances,
  useDashboardSummary,
  usePricing,
  useRecentOperations,
  useTopClients,
  useTrends,
} from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  formatAmount,
  formatCount,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/format";
import type {
  CurrencyBalance,
  LedgerEntry,
  OperationPricing,
} from "@/lib/api/types";
import type { TopClient } from "@/lib/api/hooks";

/**
 * §6.1 — the Dashboard is the *only* page carrying the 30-day trend charts and
 * the canonical currency balances (§7 items 3 and 4). Other modules link here
 * instead of repeating them.
 */
export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");

  const summary = useDashboardSummary();
  const pricing = usePricing();
  const topClients = useTopClients("balance");
  const recent = useRecentOperations();

  const pendingTotal =
    (summary.data?.pendingAuthorizedWithdrawals ?? 0) +
    (summary.data?.pendingExternalTransfers ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      {summary.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <HeaderStatBar
          stats={[
            {
              label: t("totalClients"),
              value: formatCount(summary.data?.totalClients ?? 0),
              numeric: true,
              icon: <Users className="size-4" />,
              iconTone: "accent",
            },
            {
              label: t("totalAccounts"),
              value: formatCount(summary.data?.totalAccounts ?? 0),
              numeric: true,
              icon: <Wallet className="size-4" />,
              iconTone: "accent",
            },
            {
              label: t("todayOperations"),
              value: formatCount(summary.data?.todayOperations ?? 0),
              numeric: true,
              icon: <ArrowLeftRight className="size-4" />,
              iconTone: "success",
            },
            {
              label: t("pendingApprovals"),
              value: formatCount(pendingTotal),
              numeric: true,
              icon: <Clock className="size-4" />,
              tone: pendingTotal > 0 ? "warning" : "default",
              iconTone: pendingTotal > 0 ? "warning" : "default",
            },
          ]}
        />
      )}

      <AlertsCard
        authorized={summary.data?.pendingAuthorizedWithdrawals ?? 0}
        external={summary.data?.pendingExternalTransfers ?? 0}
      />

      <TrendsCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <CurrencyBalancesCard />
        <PricingSummaryCard
          rows={pricing.data ?? []}
          loading={pricing.isLoading}
          error={pricing.isError}
          onRetry={() => pricing.refetch()}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("topClientsPreview")}
            action={
              <Link
                href="/core/top-clients"
                className="text-xs font-medium text-accent hover:underline"
              >
                {t("viewAll")}
              </Link>
            }
          />
          <DataTable<TopClient>
            columns={[
              {
                key: "name",
                header: tf("name"),
                primary: true,
                cell: (row) => row.name,
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
            ]}
            // Preview only — the full list lives on /core/top-clients.
            rows={(topClients.data ?? []).slice(0, 5)}
            getRowId={(row) => row.id}
            loading={topClients.isLoading}
            error={topClients.isError}
            onRetry={() => topClients.refetch()}
            caption={t("topClientsPreview")}
            paginate={false}
          />
        </Card>

        <Card>
          <CardHeader
            title={t("recentTransactions")}
            action={
              <Link
                href="/core/analytics/all-operations"
                className="text-xs font-medium text-accent hover:underline"
              >
                {t("viewAll")}
              </Link>
            }
          />
          <RecentTable
            rows={(recent.data ?? []).slice(0, 8)}
            loading={recent.isLoading}
            error={recent.isError}
            onRetry={() => recent.refetch()}
          />
        </Card>
      </div>
    </div>
  );
}

function AlertsCard({
  authorized,
  external,
}: {
  authorized: number;
  external: number;
}) {
  const t = useTranslations("dashboard");

  const alerts = [
    authorized > 0
      ? {
          href: "/core/authorized-withdrawal",
          text: t("alertPendingAuthorized", { count: authorized }),
        }
      : null,
    external > 0
      ? {
          href: "/core/external-transfer",
          text: t("alertPendingExternal", { count: external }),
        }
      : null,
  ].filter((alert): alert is { href: string; text: string } => alert !== null);

  return (
    <Card>
      <CardHeader title={t("alerts")} />
      <CardBody className="space-y-2">
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            {t("noAlerts")}
          </p>
        ) : (
          alerts.map((alert) => (
            <Link
              key={alert.href}
              href={alert.href}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg hover:bg-surface-muted"
            >
              <AlertTriangle className="size-4 text-warning" aria-hidden />
              {alert.text}
            </Link>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/** The ranges the Dashboard offers; 30 is the default view. */
const TREND_RANGES = [7, 30, 60, 90] as const;
type TrendRange = (typeof TREND_RANGES)[number];

/**
 * A radiogroup, not a tablist: these buttons filter one set of charts rather
 * than swapping between panels.
 */
function TrendRangeSelector({
  value,
  onChange,
}: {
  value: TrendRange;
  onChange: (value: TrendRange) => void;
}) {
  const t = useTranslations("dashboard");
  return (
    <div
      role="radiogroup"
      aria-label={t("rangeLabel")}
      className="flex gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5"
    >
      {TREND_RANGES.map((days) => {
        const selected = days === value;
        return (
          <button
            key={days}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(days)}
            className={cn(
              "numeric rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selected ? "bg-surface text-accent" : "text-fg-muted hover:text-fg",
            )}
          >
            {t("rangeDays", { days: formatCount(days) })}
          </button>
        );
      })}
    </div>
  );
}

/** The trends — one place only (§7 item 3), three series side by side. */
function TrendsCard() {
  const t = useTranslations("dashboard");
  const [days, setDays] = useState<TrendRange>(30);
  const query = useTrends(days);
  const points = (query.data ?? []).map((point, index) => ({
    ...point,
    // The axis carries the day's place in the range; the full date is on hover,
    // because 90 ISO dates on an axis are unreadable at any width.
    day: index + 1,
    fullDate: formatDate(point.date),
  }));
  const dateForDay = new Map(points.map((p) => [p.day, p.fullDate]));

  const series = [
    {
      key: "deposits" as const,
      label: t("trendDeposits"),
      color: "var(--color-chart-deposit)",
    },
    {
      key: "withdrawals" as const,
      label: t("trendWithdrawals"),
      color: "var(--color-chart-withdrawal)",
    },
    {
      key: "exchange" as const,
      label: t("trendExchange"),
      color: "var(--color-chart-exchange)",
    },
  ];

  return (
    <Card>
      <CardHeader
        title={t("trendsRange", { days: formatCount(days) })}
        action={<TrendRangeSelector value={days} onChange={setDays} />}
      />
      <CardBody>
        {query.isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {series.map((s) => (
              <div key={s.key} className="space-y-2">
                <ChartLegendSwatch color={s.color} label={s.label} />
                <TrendAreaChart
                  data={points}
                  xKey="day"
                  dataKey={s.key}
                  color={s.color}
                  height={180}
                  tooltipLabel={(value) =>
                    dateForDay.get(Number(value)) ?? String(value)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardBody>
      {/* Accessible fallback: the same points as an exact-figures table. */}
      <TrendTable days={days} />
    </Card>
  );
}

function TrendTable({ days }: { days: TrendRange }) {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const query = useTrends(days);

  return (
    <DataTable
      columns={[
        {
          key: "date",
          header: tf("date"),
          primary: true,
          cell: (row) => (
            <span className="numeric text-sm">{formatDate(row.date)}</span>
          ),
        },
        {
          key: "deposits",
          header: t("trendDeposits"),
          align: "end",
          cell: (row) => (
            <span className="numeric text-sm">{formatCount(row.deposits)}</span>
          ),
        },
        {
          key: "withdrawals",
          header: t("trendWithdrawals"),
          align: "end",
          cell: (row) => (
            <span className="numeric text-sm">
              {formatCount(row.withdrawals)}
            </span>
          ),
        },
        {
          key: "exchange",
          header: t("trendExchange"),
          align: "end",
          cell: (row) => (
            <span className="numeric text-sm">{formatCount(row.exchange)}</span>
          ),
        },
      ]}
      rows={query.data ?? []}
      getRowId={(row) => row.date}
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => query.refetch()}
      caption={t("trendsRange", { days: formatCount(days) })}
    />
  );
}

/** Canonical currency balances (§7 item 4) — donut plus exact figures. */
function CurrencyBalancesCard() {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const tStats = useTranslations("stats");
  const query = useCurrencyBalances();
  const rows = query.data ?? [];

  const columns: Column<CurrencyBalance>[] = [
    {
      key: "currency",
      header: tf("currency"),
      primary: true,
      cell: (row) => <span className="numeric text-sm">{row.currency}</span>,
    },
    {
      key: "accounts",
      header: tStats("count"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm">{formatCount(row.accounts)}</span>
      ),
    },
    {
      key: "total",
      header: tStats("total"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm font-medium">
          {formatAmount(row.total, row.currency)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader title={t("currencyBalances")} />
      <CardBody>
        {query.isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <CompositionDonut
            data={rows as unknown as Record<string, unknown>[]}
            nameKey="currency"
            valueKey="total"
          />
        )}
      </CardBody>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.currency}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        caption={t("currencyShare")}
        paginate={false}
      />
    </Card>
  );
}

function PricingSummaryCard({
  rows,
  loading,
  error,
  onRetry,
}: {
  rows: OperationPricing[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const labels = useLabels();

  const columns: Column<OperationPricing>[] = [
    {
      key: "operation",
      header: tf("type"),
      primary: true,
      cell: (row) => labels.operationType(row.operation),
    },
    {
      key: "fee",
      header: tf("fee"),
      align: "end",
      // §7 item 9: zero-fee operations show a status, never a "0.000" figure.
      cell: (row) =>
        row.hasFee && row.feeValue !== null ? (
          <span className="numeric text-sm">
            {row.feeType === "percentage"
              ? `${formatNumber(row.feeValue, 2)}%`
              : formatAmount(row.feeValue, row.currency ?? "")}
          </span>
        ) : (
          <Badge tone="neutral">{tc("no")}</Badge>
        ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title={t("pricingSummary")}
        action={
          <Link
            href="/core/system/operations-pricing"
            className="text-xs font-medium text-accent hover:underline"
          >
            {t("pricingManageLink")}
          </Link>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        caption={t("pricingSummary")}
        paginate={false}
      />
    </Card>
  );
}

function RecentTable({
  rows,
  loading,
  error,
  onRetry,
}: {
  rows: LedgerEntry[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const labels = useLabels();

  const columns: Column<LedgerEntry>[] = [
    {
      key: "client",
      header: tf("client"),
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{row.clientName}</span>
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
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      caption={t("recentTransactions")}
      paginate={false}
    />
  );
}

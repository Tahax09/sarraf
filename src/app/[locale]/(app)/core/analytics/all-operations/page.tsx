"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectInput, TextInput } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { CategoryBarChart, CompositionDonut } from "@/components/charts";
import { useAllOperations, useBranches } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { downloadCsv } from "@/lib/export";
import { formatAmount, formatCount, formatDateTime } from "@/lib/format";
import type { LedgerEntry, OperationType } from "@/lib/api/types";

const OPERATION_TYPES: OperationType[] = [
  "deposit",
  "withdrawal",
  "authorizedWithdrawal",
  "externalTransfer",
  "fundTransfer",
  "currencyExchangeTransfer",
];

/**
 * §6.7 — the full ledger (thousands of rows). Virtualized, with the operation
 * type mix as a donut over the loaded page and every enum passed through the
 * label dictionary (§7 item 2).
 */
export default function AllOperationsPage() {
  const t = useTranslations("analytics");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();

  const [filters, setFilters] = useState({ type: "", branchId: "", q: "" });
  // The ledger is fetched wide and paged client-side by the table.
  const query = useAllOperations({ ...filters, pageSize: 500 });
  const branches = useBranches();
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  const mix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({
      type: labels.operationType(type),
      count,
    }));
  }, [rows, labels]);

  // Currencies present in the loaded rows, busiest first — the volume chart can
  // only add up amounts that share a currency, so it charts one at a time.
  const mixCurrencies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.currency, (counts.get(row.currency) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([currency]) => currency);
  }, [rows]);

  const [mixCurrency, setMixCurrency] = useState("");
  const volumeCurrency =
    mixCurrency && mixCurrencies.includes(mixCurrency)
      ? mixCurrency
      : (mixCurrencies[0] ?? "");

  const volume = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      if (row.currency !== volumeCurrency) continue;
      totals.set(row.type, (totals.get(row.type) ?? 0) + row.amount);
    }
    return [...totals.entries()].map(([type, amount]) => ({
      type: labels.operationType(type),
      amount,
    }));
  }, [rows, labels, volumeCurrency]);

  // §7 item 9: the fee column exists only when some row actually carries a fee.
  const anyFee = rows.some((row) => (row.feeAmount ?? 0) > 0);

  const columns: Column<LedgerEntry>[] = [
    {
      key: "client",
      header: tf("client"),
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{row.clientName}</span>
          <span className="numeric text-xs text-fg-muted">
            {row.accountNumber}
          </span>
        </span>
      ),
    },
    {
      key: "event",
      header: tf("type"),
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{labels.ledgerEvent(row.event)}</span>
          <span className="text-xs text-fg-muted">
            {labels.operationType(row.type)}
          </span>
        </span>
      ),
    },
    {
      key: "branch",
      header: tf("branch"),
      cell: (row) => row.branchName,
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
      key: "fee",
      header: tf("fee"),
      align: "end",
      hidden: !anyFee,
      cell: (row) =>
        (row.feeAmount ?? 0) > 0 ? (
          <span className="numeric text-sm">
            {formatAmount(row.feeAmount as number, row.currency)}
          </span>
        ) : (
          <span className="text-fg-subtle">{tc("notAvailable")}</span>
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

  const anyFilter = Object.values(filters).some((value) => value !== "");

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("allOperationsTitle")}
        actions={
          <Button
            variant="secondary"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                "all-operations",
                [
                  tf("reference"),
                  tf("client"),
                  tf("accountNumber"),
                  tf("type"),
                  tf("branch"),
                  tf("amount"),
                  tf("currency"),
                  tf("fee"),
                  tf("date"),
                ],
                rows.map((row) => [
                  row.reference,
                  row.clientName,
                  row.accountNumber,
                  labels.ledgerEvent(row.event),
                  row.branchName,
                  row.amount,
                  row.currency,
                  row.feeAmount ?? "",
                  row.createdAt,
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
            value: formatCount(query.data?.total ?? 0),
            numeric: true,
          },
          {
            label: tc("showing", {
              from: rows.length === 0 ? 0 : 1,
              to: rows.length,
              total: query.data?.total ?? 0,
            }),
            value: formatCount(rows.length),
            numeric: true,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("operationTypeMix")} />
          <CardBody>
            {query.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <CompositionDonut
                data={mix as unknown as Record<string, unknown>[]}
                nameKey="type"
                valueKey="count"
                // Side legend: the labels are long enough that a legend under
                // the ring squeezes the ring flat.
                legend="side"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t("operationVolumeByType")}
            action={
              mixCurrencies.length > 1 ? (
                // A bare select: the card title already says what it picks.
                <select
                  aria-label={tf("currency")}
                  value={volumeCurrency}
                  onChange={(event) => setMixCurrency(event.target.value)}
                  className="numeric rounded-lg border border-border bg-surface px-2 py-1 text-xs text-fg focus:border-accent focus:outline-none"
                >
                  {mixCurrencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              ) : null
            }
          />
          <CardBody>
            {query.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <CategoryBarChart
                data={volume as unknown as Record<string, unknown>[]}
                xKey="type"
                series={[
                  {
                    key: "amount",
                    label: t("volumeIn", { currency: volumeCurrency }),
                    color: "var(--color-chart-exchange)",
                  },
                ]}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-3">
          <SelectInput
            label={tf("type")}
            value={filters.type}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, type: event.target.value }))
            }
          >
            <option value="">{tc("all")}</option>
            {OPERATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {labels.operationType(type)}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            label={tf("branch")}
            value={filters.branchId}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, branchId: event.target.value }))
            }
          >
            <option value="">{tc("all")}</option>
            {(branches.data ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </SelectInput>
          <TextInput
            label={tc("search")}
            placeholder={tc("searchPlaceholder")}
            value={filters.q}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, q: event.target.value }))
            }
          />
          {anyFilter ? (
            <div className="sm:col-span-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ type: "", branchId: "", q: "" })}
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
          caption={t("allOperationsTitle")}
          detailTitle={(row) => row.clientName}
          renderDetail={(row) => (
            <DetailSection title={tf("reference")}>
              {/* Reference and raw id stay out of the table (§7 item 10). */}
              <DetailRow label={tf("reference")} value={row.reference} numeric />
              <DetailRow label={tf("entryId")} value={row.id} numeric />
              <DetailRow
                label={tf("accountNumber")}
                value={row.accountNumber}
                numeric
              />
              <DetailRow
                label={tf("type")}
                value={labels.ledgerEvent(row.event)}
              />
              <DetailRow label={tf("branch")} value={row.branchName} />
              <DetailRow
                label={tf("amount")}
                value={formatAmount(row.amount, row.currency)}
                numeric
              />
              {(row.feeAmount ?? 0) > 0 ? (
                <DetailRow
                  label={tf("fee")}
                  value={formatAmount(row.feeAmount as number, row.currency)}
                  numeric
                />
              ) : null}
              <DetailRow
                label={tf("date")}
                value={formatDateTime(row.createdAt)}
                numeric
              />
            </DetailSection>
          )}
        />
      </Card>
    </div>
  );
}

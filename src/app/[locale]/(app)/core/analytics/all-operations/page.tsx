"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutList, ListOrdered } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ExportActions } from "@/components/shared/export-actions";
import { FilterBar } from "@/components/shared/filter-bar";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { useClientNameText } from "@/components/shared/cells";
import { CategoryBarChart, CompositionDonut } from "@/components/charts";
import { useAllOperations, useBranches } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { useTableQuery } from "@/lib/use-table-query";
import { useFilters, type FilterDef } from "@/lib/filters";
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
 * How many of the most recent matching entries the two charts summarise.
 *
 * The backend exposes no aggregate endpoint for the ledger, so a mix or a
 * volume figure has to be computed from rows this page actually holds. Rather
 * than let that quietly become "whatever page you are on", the charts read a
 * fixed, bounded sample and both cards state that scope in their subtitle.
 */
const CHART_SAMPLE_SIZE = 200;

/**
 * §6.7 — the full ledger. The table is paged, ordered and searched by the
 * server, so the record count is the backend's `total` and no row is ever
 * silently dropped. The two charts above it summarise a bounded, explicitly
 * labelled sample; every enum passes through the label dictionary (§7 item 2).
 */
export default function AllOperationsPage() {
  const t = useTranslations("analytics");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();
  const clientName = useClientNameText();

  const branches = useBranches();
  const filterDefs: FilterDef[] = [
    {
      key: "type",
      type: "select",
      label: tf("type"),
      options: OPERATION_TYPES.map((type) => ({
        value: type,
        label: labels.operationType(type),
      })),
    },
    {
      key: "branchId",
      type: "select",
      label: tf("branch"),
      options: (branches.data ?? []).map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    },
    { key: "date", type: "dateRange", label: tf("date") },
    { key: "amount", type: "amountRange", label: tf("amount") },
  ];
  const filters = useFilters(filterDefs, { persistKey: "all-operations" });

  const table = useTableQuery({
    filters: filters.params,
    sort: { key: "createdAt", direction: "desc" },
  });
  const query = useAllOperations(table.params);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  // Chart scope: same filters and search term, first page, sample-sized. Kept
  // apart from `table.params` so paging or re-ordering the table never moves
  // the charts underneath the reader.
  const sample = useAllOperations({
    ...table.params,
    page: 1,
    pageSize: CHART_SAMPLE_SIZE,
    sort: undefined,
  });
  const sampleRows = useMemo(() => sample.data?.items ?? [], [sample.data]);
  const chartScope = t("chartScope", { count: formatCount(sampleRows.length) });

  const mix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of sampleRows) {
      counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({
      type: labels.operationType(type),
      count,
    }));
  }, [sampleRows, labels]);

  // Currencies present in the sample, busiest first — the volume chart can only
  // add up amounts that share a currency, so it charts one at a time.
  const mixCurrencies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of sampleRows) {
      counts.set(row.currency, (counts.get(row.currency) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([currency]) => currency);
  }, [sampleRows]);

  const [mixCurrency, setMixCurrency] = useState("");
  const volumeCurrency =
    mixCurrency && mixCurrencies.includes(mixCurrency)
      ? mixCurrency
      : (mixCurrencies[0] ?? "");

  const volume = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of sampleRows) {
      if (row.currency !== volumeCurrency) continue;
      totals.set(row.type, (totals.get(row.type) ?? 0) + row.amount);
    }
    return [...totals.entries()].map(([type, amount]) => ({
      type: labels.operationType(type),
      amount,
    }));
  }, [sampleRows, labels, volumeCurrency]);

  // §7 item 9: the fee column exists only when some row actually carries a fee.
  // Read from the sample, not the current page, so the column does not appear
  // and disappear as the reader pages through the ledger.
  const anyFee = sampleRows.some((row) => (row.feeAmount ?? 0) > 0);

  const columns: Column<LedgerEntry>[] = [
    {
      key: "client",
      header: tf("client"),
      primary: true,
      sortKey: "clientName",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <bdi className="truncate text-sm">
            {clientName(row.clientName, row.clientNameEn)}
          </bdi>
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
      sortKey: "amount",
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
      sortKey: "createdAt",
      cell: (row) => (
        <span className="identifier text-xs text-fg-muted">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
  ];

  // The pager only ever holds one page in memory, so the export covers the page
  // on screen. A whole-ledger export needs a backend export endpoint.
  const firstRow = total === 0 ? 0 : (table.page - 1) * table.pageSize + 1;
  const lastRow = firstRow === 0 ? 0 : firstRow + rows.length - 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("allOperationsTitle")}
        actions={
          <ExportActions
            filename="all-operations"
            title={t("allOperationsTitle")}
            excelLabel={tc("exportPage")}
            // No print button: the page is a working surface — a filter bar and
            // two sampled charts — not a document. The Reports page is where a
            // printable snapshot lives.
            print={false}
            meta={[
              tc("showing", {
                from: formatCount(firstRow),
                to: formatCount(lastRow),
                total: formatCount(total),
              }),
            ]}
            rows={rows}
            columns={[
              { header: tf("reference"), value: (row) => row.reference, width: 20 },
              {
                header: tf("client"),
                value: (row) => clientName(row.clientName, row.clientNameEn),
                width: 26,
              },
              // Text, not a number: an account number is an identifier, and
              // Excel would eat its leading zero and round its 16th digit.
              { header: tf("accountNumber"), value: (row) => row.accountNumber, width: 22 },
              { header: tf("type"), value: (row) => labels.ledgerEvent(row.event), width: 22 },
              { header: tf("branch"), value: (row) => row.branchName, width: 22 },
              {
                header: tf("amount"),
                value: (row) => row.amount,
                type: "number",
                format: "#,##0.000",
              },
              { header: tf("currency"), value: (row) => row.currency, width: 10 },
              {
                header: tf("fee"),
                value: (row) => row.feeAmount ?? null,
                type: "number",
                format: "#,##0.000",
              },
              { header: tf("date"), value: (row) => formatDateTime(row.createdAt), width: 20 },
            ]}
          />
        }
      />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(total),
            numeric: true,
            icon: <ListOrdered className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
          {
            label: tc("showing", {
              from: formatCount(firstRow),
              to: formatCount(lastRow),
              total: formatCount(total),
            }),
            value: formatCount(rows.length),
            numeric: true,
            icon: <LayoutList className="size-4" aria-hidden />,
            color: "var(--color-chart-4)",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("operationTypeMix")} description={chartScope} />
          <CardBody>
            <CompositionDonut
              data={mix}
              nameKey="type"
              valueKey="count"
              // Side legend: the labels are long enough that a legend under
              // the ring squeezes the ring flat.
              legend="side"
              loading={sample.isLoading}
              error={sample.isError}
              onRetry={() => sample.refetch()}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t("operationVolumeByType")}
            description={chartScope}
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
            <CategoryBarChart
              data={volume}
              xKey="type"
              series={[
                {
                  key: "amount",
                  label: t("volumeIn", { currency: volumeCurrency }),
                  color: "var(--color-chart-exchange)",
                },
              ]}
              loading={sample.isLoading}
              error={sample.isError}
              onRetry={() => sample.refetch()}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <FilterBar
          defs={filterDefs}
          state={filters}
          search={table.search}
          onSearchChange={table.setSearch}
        />

        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          // The ledger is the one register long enough to push its own filters
          // and pager off the screen, so it scrolls inside the card instead.
          scroll
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("allOperationsTitle")}
          pagination={{
            page: table.page,
            pageSize: table.pageSize,
            total,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }}
          sort={table.sort}
          onSortChange={table.setSort}
          detailTitle={(row) => clientName(row.clientName, row.clientNameEn)}
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
                identifier
              />
            </DetailSection>
          )}
        />
      </Card>
    </div>
  );
}

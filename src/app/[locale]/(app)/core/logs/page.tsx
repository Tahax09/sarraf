"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, ScrollText, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { useLogs } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatCount, formatDateTime } from "@/lib/format";
import { useTableQuery } from "@/lib/use-table-query";
import { useFilters, type FilterDef } from "@/lib/filters";
import type { LogLevel, SystemLog } from "@/lib/api/types";

const LEVELS: LogLevel[] = ["info", "warning", "error"];
const TAGS = ["sms", "auth", "ledger", "cbl", "export"];

const LEVEL_TONE: Record<LogLevel, "info" | "warning" | "danger"> = {
  info: "info",
  warning: "warning",
  error: "danger",
};

/** §7: system logs and audit logs are one page — one filter set, one table. */
export default function LogsPage() {
  const t = useTranslations("logs");
  const tf = useTranslations("fields");
  const tStats = useTranslations("stats");
  const labels = useLabels();

  const filterDefs: FilterDef[] = [
    {
      key: "level",
      type: "select",
      label: t("filterType"),
      options: LEVELS.map((level) => ({
        value: level,
        label: labels.logLevel(level),
      })),
    },
    {
      key: "tag",
      type: "select",
      label: t("filterTags"),
      options: TAGS.map((tag) => ({ value: tag, label: tag })),
    },
    { key: "date", type: "dateRange", label: tf("date") },
  ];
  const filters = useFilters(filterDefs, { persistKey: "logs" });

  const table = useTableQuery({
    filters: filters.params,
    sort: { key: "createdAt", direction: "desc" },
  });
  const query = useLogs(table.params);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  // Severity counts have to cover the whole filtered range, not the rows that
  // happen to be on screen — one page of a log is no basis for "how many errors
  // are there". Asking for a single row and reading `total` is the cheapest way
  // to get the count from the server.
  const errorCount = useLogs({ ...filters.params, level: "error", pageSize: 1 });
  const warningCount = useLogs({
    ...filters.params,
    level: "warning",
    pageSize: 1,
  });

  const columns: Column<SystemLog>[] = [
    {
      key: "title",
      header: tf("title"),
      primary: true,
      sortKey: "title",
      cell: (row) => row.title,
    },
    {
      key: "level",
      header: tf("level"),
      sortKey: "level",
      cell: (row) => (
        <Badge tone={LEVEL_TONE[row.level]}>{labels.logLevel(row.level)}</Badge>
      ),
    },
    {
      key: "tags",
      header: tf("tags"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: "timestamp",
      header: tf("timestamp"),
      sortKey: "createdAt",
      // Every entry carries a timestamp — no blank cells here.
      cell: (row) => (
        <span className="identifier text-xs text-fg-muted">
          {formatDateTime(row.createdAt)}
        </span>
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
            value: formatCount(total),
            numeric: true,
            icon: <ScrollText className="size-4" aria-hidden />,
            color: "var(--color-accent)",
          },
          {
            label: t("levelError"),
            value: formatCount(errorCount.data?.total ?? 0),
            numeric: true,
            tone: "danger",
            icon: <CircleAlert className="size-4" aria-hidden />,
          },
          {
            label: t("levelWarning"),
            value: formatCount(warningCount.data?.total ?? 0),
            numeric: true,
            tone: "warning",
            icon: <TriangleAlert className="size-4" aria-hidden />,
          },
        ]}
      />

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
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("title")}
          paging={{
            page: table.page,
            pageSize: table.pageSize,
            total,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }}
          sort={table.sort}
          onSortChange={table.setSort}
          detailTitle={(row) => row.title}
          renderDetail={(row) => (
            <DetailSection title={t("rawMessage")}>
              <DetailRow label={tf("entryId")} value={row.id} numeric />
              <DetailRow
                label={tf("level")}
                value={labels.logLevel(row.level)}
              />
              <DetailRow label={tf("tags")} value={row.tags.join("، ")} />
              <DetailRow
                label={tf("timestamp")}
                value={formatDateTime(row.createdAt)}
                identifier
              />
              <DetailRow label={tf("message")} value={row.message} />
            </DetailSection>
          )}
        />
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput, TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { useLogs } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatCount, formatDateTime } from "@/lib/format";
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
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();

  const [filters, setFilters] = useState({ level: "", tag: "", q: "" });
  const query = useLogs({ ...filters, pageSize: 200 });
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  const columns: Column<SystemLog>[] = [
    {
      key: "title",
      header: tf("title"),
      primary: true,
      cell: (row) => row.title,
    },
    {
      key: "level",
      header: tf("level"),
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
      // Every entry carries a timestamp — no blank cells here.
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
      <PageHeader title={t("title")} />

      <HeaderStatBar
        stats={[
          {
            label: tStats("count"),
            value: formatCount(query.data?.total ?? 0),
            numeric: true,
          },
          {
            label: t("levelError"),
            value: formatCount(
              rows.filter((row) => row.level === "error").length,
            ),
            numeric: true,
            tone: "danger",
          },
          {
            label: t("levelWarning"),
            value: formatCount(
              rows.filter((row) => row.level === "warning").length,
            ),
            numeric: true,
            tone: "warning",
          },
        ]}
      />

      <Card>
        <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-3">
          <SelectInput
            label={t("filterType")}
            value={filters.level}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, level: event.target.value }))
            }
          >
            <option value="">{tc("all")}</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {labels.logLevel(level)}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            label={t("filterTags")}
            value={filters.tag}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, tag: event.target.value }))
            }
          >
            <option value="">{tc("all")}</option>
            {TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
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
                onClick={() => setFilters({ level: "", tag: "", q: "" })}
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
          caption={t("title")}
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
                numeric
              />
              <DetailRow label={tf("message")} value={row.message} />
            </DetailSection>
          )}
        />
      </Card>
    </div>
  );
}

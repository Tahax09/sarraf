"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { SelectInput, TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { HeaderStatBar } from "@/components/shared/header-stat-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { ClientCell } from "@/components/shared/cells";
import { useAccounts, useBranches, useCurrencies } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatAmount, formatCount, formatPhone } from "@/lib/format";
import type { Account } from "@/lib/api/types";

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tStats = useTranslations("stats");
  const labels = useLabels();

  const [filters, setFilters] = useState({
    q: "",
    currency: "",
    branchId: "",
  });

  const query = useAccounts({ ...filters, pageSize: 200 });
  const currencies = useCurrencies();
  const branches = useBranches();
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.balance);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [rows]);

  const columns: Column<Account>[] = [
    {
      key: "number",
      header: tf("accountNumber"),
      primary: true,
      cell: (row) => <span className="numeric text-sm">{row.number}</span>,
    },
    {
      key: "client",
      header: tf("client"),
      cell: (row) => <ClientCell name={row.clientName} phone={row.clientPhone} />,
    },
    {
      key: "type",
      header: tf("accountType"),
      cell: (row) => labels.accountType(row.type),
    },
    {
      key: "branch",
      header: tf("branch"),
      cell: (row) => row.branchName,
    },
    {
      key: "balance",
      header: tf("balance"),
      align: "end",
      cell: (row) => (
        <span className="numeric text-sm font-medium text-fg">
          {formatAmount(row.balance, row.currency)}
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
          ...totals.map(([currency, total]) => ({
            label: `${tStats("total")} — ${currency}`,
            value: formatAmount(total, currency),
            numeric: true,
          })),
        ]}
      />

      <Card>
        <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-3">
          <TextInput
            label={tc("search")}
            placeholder={tc("searchPlaceholder")}
            value={filters.q}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, q: event.target.value }))
            }
          />
          <SelectInput
            label={tf("currency")}
            value={filters.currency}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, currency: event.target.value }))
            }
          >
            <option value="">{tc("all")}</option>
            {(currencies.data ?? []).map((currency) => (
              <option key={currency.id} value={currency.alphabeticCode}>
                {currency.alphabeticCode} — {currency.name}
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
          {anyFilter ? (
            <div className="sm:col-span-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ q: "", currency: "", branchId: "" })}
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
          detailTitle={(row) => row.number}
          renderDetail={(row) => (
            <>
              <DetailSection title={tc("details")}>
                <DetailRow label={tf("entryId")} value={row.id} numeric />
                <DetailRow
                  label={tf("accountNumber")}
                  value={row.number}
                  numeric
                />
                <DetailRow
                  label={tf("accountType")}
                  value={labels.accountType(row.type)}
                />
                <DetailRow label={tf("currency")} value={row.currency} />
                <DetailRow
                  label={tf("balance")}
                  value={formatAmount(row.balance, row.currency)}
                  numeric
                />
                <DetailRow label={tf("branch")} value={row.branchName} />
              </DetailSection>

              <DetailSection title={tf("client")}>
                <DetailRow label={tf("clientName")} value={row.clientName} />
                <DetailRow
                  label={tf("phone")}
                  value={formatPhone(row.clientPhone)}
                  numeric
                />
              </DetailSection>
            </>
          )}
        />
      </Card>
    </div>
  );
}

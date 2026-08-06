"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { usePricing } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatAmount, formatNumber } from "@/lib/format";
import type { OperationPricing } from "@/lib/api/types";

export function PricingSummaryCard() {
  const t = useTranslations("dashboard");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const labels = useLabels();
  const query = usePricing();

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
            className={buttonStyles({ variant: "link", className: "-me-1 text-xs" })}
          >
            {t("pricingManageLink")}
          </Link>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data ?? []}
        getRowId={(row) => row.id}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        caption={t("pricingSummary")}
        paging="none"
      />
    </Card>
  );
}

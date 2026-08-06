"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { SelectInput, TextInput, Toggle } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { usePricing, useSavePricing, useCurrencies } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import { formatAmount } from "@/lib/format";
import type { FeeType, OperationPricing } from "@/lib/api/types";

export default function OperationsPricingPage() {
  const t = useTranslations("pricing");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const labels = useLabels();

  const query = usePricing();
  const currencies = useCurrencies();
  const save = useSavePricing();
  const [editing, setEditing] = useState<OperationPricing | null>(null);

  const columns: Column<OperationPricing>[] = [
    {
      key: "operation",
      header: t("operation"),
      primary: true,
      sortKey: true,
      sortValue: (row) => labels.operationType(row.operation),
      cell: (row) => labels.operationType(row.operation),
    },
    {
      key: "hasFee",
      header: tf("hasFee"),
      sortKey: true,
      sortValue: (row) => (row.hasFee ? 1 : 0),
      cell: (row) => (
        <Badge tone={row.hasFee ? "info" : "success"}>
          {row.hasFee ? t("paid") : t("free")}
        </Badge>
      ),
    },
    {
      key: "fee",
      header: tf("fee"),
      align: "end",
      sortKey: true,
      // A percentage and a flat amount are not comparable figures, so the
      // ordering is on the number as entered — which is what the column shows.
      sortValue: (row) => (row.hasFee ? (row.feeValue ?? 0) : 0),
      // §7: no fee figure is shown for operations that carry none.
      cell: (row) =>
        row.hasFee && row.feeValue ? (
          <span className="numeric text-sm">
            {row.feeType === "percentage"
              ? `${row.feeValue}%`
              : formatAmount(row.feeValue, row.currency ?? "")}
          </span>
        ) : (
          <span className="text-sm text-fg-subtle">{tc("notAvailable")}</span>
        ),
    },
    {
      key: "actions",
      header: tc("actions"),
      align: "end",
      cell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            setEditing(row);
          }}
        >
          {tc("edit")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <Card>
        <DataTable
          columns={columns}
          rows={query.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isLoading}
          error={query.isError}
          onRetry={() => query.refetch()}
          caption={t("title")}
        />
      </Card>

      {editing ? (
        <PricingDialog
          key={editing.id}
          value={editing}
          currencies={(currencies.data ?? []).map((c) => c.alphabeticCode)}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            await save.mutateAsync(next);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PricingDialog({
  value,
  currencies,
  saving,
  onClose,
  onSave,
}: {
  value: OperationPricing;
  currencies: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (value: OperationPricing) => void;
}) {
  const t = useTranslations("pricing");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const labels = useLabels();
  const [draft, setDraft] = useState<OperationPricing>(value);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("editTitle", { operation: labels.operationType(value.operation) })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button loading={saving} onClick={() => onSave(draft)}>
            {tc("save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Toggle
          label={tf("hasFee")}
          checked={draft.hasFee}
          onChange={(checked) =>
            setDraft((prev) => ({
              ...prev,
              hasFee: checked,
              // Clearing the figures keeps zero-fee rows genuinely empty.
              feeType: checked ? (prev.feeType ?? "fixed") : null,
              feeValue: checked ? (prev.feeValue ?? 0) : null,
              currency: checked ? prev.currency : null,
            }))
          }
        />

        {draft.hasFee ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectInput
              label={tf("feeType")}
              value={draft.feeType ?? "fixed"}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  feeType: event.target.value as FeeType,
                }))
              }
            >
              <option value="fixed">{labels.feeType("fixed")}</option>
              <option value="percentage">{labels.feeType("percentage")}</option>
            </SelectInput>
            <TextInput
              label={tf("feeValue")}
              numeric
              inputMode="decimal"
              value={String(draft.feeValue ?? 0)}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  feeValue: Number(event.target.value),
                }))
              }
            />
            {draft.feeType === "fixed" ? (
              <SelectInput
                label={tf("currency")}
                value={draft.currency ?? ""}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, currency: event.target.value }))
                }
              >
                <option value="">{tc("selectPlaceholder")}</option>
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </SelectInput>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

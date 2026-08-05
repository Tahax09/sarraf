"use client";

import { useTranslations } from "next-intl";
import { SelectInput, TextInput, Toggle } from "@/components/ui/field";
import type { FeeType } from "@/lib/api/types";
import { useLabels } from "@/lib/labels";
import { formatAmount } from "@/lib/format";

export type FeeValue = {
  enabled: boolean;
  type: FeeType;
  value: number;
};

/**
 * Fee toggle. Type/value inputs only exist while a fee is actually charged —
 * the source app rendered them (and zero-value fee columns) unconditionally.
 */
export function ConditionalFeeBlock({
  value,
  onChange,
  baseAmount,
  currency,
  error,
}: {
  value: FeeValue;
  onChange: (value: FeeValue) => void;
  /** Used to preview a percentage fee as a concrete amount. */
  baseAmount?: number;
  currency?: string;
  error?: string;
}) {
  const t = useTranslations("fields");
  const labels = useLabels();

  const preview =
    value.enabled && baseAmount && currency
      ? value.type === "percentage"
        ? (baseAmount * value.value) / 100
        : value.value
      : null;

  return (
    <div className="space-y-3">
      <Toggle
        label={t("hasFee")}
        checked={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
      />
      {value.enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectInput
            label={t("feeType")}
            value={value.type}
            onChange={(event) =>
              onChange({ ...value, type: event.target.value as FeeType })
            }
          >
            <option value="fixed">{labels.feeType("fixed")}</option>
            <option value="percentage">{labels.feeType("percentage")}</option>
          </SelectInput>
          <TextInput
            label={t("feeValue")}
            numeric
            inputMode="decimal"
            error={error}
            value={String(value.value)}
            onChange={(event) =>
              onChange({ ...value, value: Number(event.target.value) || 0 })
            }
            hint={
              preview !== null && currency
                ? formatAmount(preview, currency)
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}

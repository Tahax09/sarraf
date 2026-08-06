"use client";

import { useTranslations } from "next-intl";
import { ArrowLeftRight } from "lucide-react";
import { TransferList } from "@/components/modules/transfer-list";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { useCeftOperations } from "@/lib/api/hooks";
import { formatAmount, formatRate } from "@/lib/format";
import type { CeftOperation } from "@/lib/api/types";

export default function CeftListPage() {
  const t = useTranslations("ceft");
  const tf = useTranslations("fields");

  return (
    <TransferList<CeftOperation>
      title={t("listTitle")}
      amountLabel={tf("sentAmount")}
      registerHref="/core/currency-exchange-transfer/register"
      useData={useCeftOperations}
      statIcon={<ArrowLeftRight className="size-4" aria-hidden />}
      statColor="var(--color-chart-exchange)"
      // §7: the two amount columns are distinctly labelled — sent vs. converted.
      amountColumns={[
        {
          key: "sent",
          header: tf("sentAmount"),
          align: "end",
          cell: (row) => (
            <span className="numeric text-sm font-medium text-fg">
              {formatAmount(row.sentAmount, row.currency)}
            </span>
          ),
        },
        {
          key: "converted",
          header: tf("convertedAmount"),
          align: "end",
          cell: (row) => (
            <span className="numeric text-sm font-medium text-fg">
              {formatAmount(row.convertedAmount, row.convertedCurrency)}
            </span>
          ),
        },
      ]}
      renderExtraDetail={(row) => (
        <DetailSection title={t("rateApplied")}>
          <DetailRow
            label={tf("sentAmount")}
            value={formatAmount(row.sentAmount, row.currency)}
            numeric
          />
          <DetailRow
            label={tf("convertedAmount")}
            value={formatAmount(row.convertedAmount, row.convertedCurrency)}
            numeric
          />
          <DetailRow
            label={tf("exchangeRate")}
            value={`1 ${row.currency} = ${formatRate(row.exchangeRate)} ${
              row.convertedCurrency
            }`}
            numeric
          />
        </DetailSection>
      )}
    />
  );
}

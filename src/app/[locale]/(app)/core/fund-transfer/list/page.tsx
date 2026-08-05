"use client";

import { useTranslations } from "next-intl";
import { TransferList } from "@/components/modules/transfer-list";
import { AmountCell } from "@/components/shared/cells";
import { useFundTransfers } from "@/lib/api/hooks";
import type { FundTransferOperation } from "@/lib/api/types";

export default function FundTransferListPage() {
  const t = useTranslations("fundTransfer");
  const tf = useTranslations("fields");

  return (
    <TransferList<FundTransferOperation>
      title={t("listTitle")}
      amountLabel={tf("transferAmount")}
      registerHref="/core/fund-transfer/register"
      useData={useFundTransfers}
      amountColumns={[
        {
          key: "amount",
          header: tf("transferAmount"),
          align: "end",
          cell: (row) => (
            <AmountCell
              amount={row.amount}
              currency={row.currency}
              fee={row.fee}
            />
          ),
        },
      ]}
    />
  );
}

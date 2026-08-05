"use client";

import { useTranslations } from "next-intl";
import { SimpleOperationList } from "@/components/modules/simple-operation-list";
import { useWithdrawals } from "@/lib/api/hooks";

export default function WithdrawalListPage() {
  const t = useTranslations("withdrawal");
  return (
    <SimpleOperationList
      title={t("listTitle")}
      amountLabel={t("amountLabel")}
      registerHref="/core/withdrawal/register"
      useData={useWithdrawals}
      showIban
    />
  );
}

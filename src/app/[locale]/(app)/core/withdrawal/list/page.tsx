"use client";

import { useTranslations } from "next-intl";
import { ArrowUpFromLine } from "lucide-react";
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
      statIcon={<ArrowUpFromLine className="size-4" aria-hidden />}
      statColor="var(--color-chart-withdrawal)"
    />
  );
}

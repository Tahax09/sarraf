"use client";

import { useTranslations } from "next-intl";
import { ArrowDownToLine } from "lucide-react";
import { SimpleOperationList } from "@/components/modules/simple-operation-list";
import { useDeposits } from "@/lib/api/hooks";

export default function DepositListPage() {
  const t = useTranslations("deposit");
  return (
    <SimpleOperationList
      title={t("listTitle")}
      amountLabel={t("amountLabel")}
      registerHref="/core/deposit/register"
      useData={useDeposits}
      statIcon={<ArrowDownToLine className="size-4" aria-hidden />}
      statColor="var(--color-chart-deposit)"
    />
  );
}

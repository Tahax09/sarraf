"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { SingleWorkflowForm } from "@/components/forms/single-workflow-form";
import { endpoints } from "@/lib/api/endpoints";

export default function WithdrawalRegisterPage() {
  const t = useTranslations("withdrawal");
  return (
    <div className="space-y-4">
      <PageHeader title={t("registerTitle")} />
      <SingleWorkflowForm
        amountLabel={t("amountLabel")}
        endpoint={endpoints.withdrawals}
        redirectTo="/core/withdrawal/list"
      />
    </div>
  );
}

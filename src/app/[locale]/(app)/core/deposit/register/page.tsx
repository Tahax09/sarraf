"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { SingleWorkflowForm } from "@/components/forms/single-workflow-form";
import { endpoints } from "@/lib/api/endpoints";

export default function DepositRegisterPage() {
  const t = useTranslations("deposit");
  return (
    <div className="space-y-4">
      <PageHeader title={t("registerTitle")} />
      <SingleWorkflowForm
        amountLabel={t("amountLabel")}
        endpoint={endpoints.deposits}
        redirectTo="/core/deposit/list"
        // A deposit credits the account, so no balance ceiling applies.
        checkBalance={false}
      />
    </div>
  );
}

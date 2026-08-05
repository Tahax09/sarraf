"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { ExternalTransferForm } from "@/components/forms/external-transfer-form";

export default function ExternalTransferRegisterPage() {
  const t = useTranslations("externalTransfer");
  return (
    <div className="space-y-4">
      <PageHeader title={t("registerTitle")} />
      <ExternalTransferForm />
    </div>
  );
}

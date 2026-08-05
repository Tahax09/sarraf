"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DualPartyForm } from "@/components/forms/dual-party-form";
import { endpoints } from "@/lib/api/endpoints";

export default function FundTransferRegisterPage() {
  const t = useTranslations("fundTransfer");
  return (
    <div className="space-y-4">
      <PageHeader title={t("registerTitle")} />
      <DualPartyForm
        endpoint={endpoints.fundTransfers}
        redirectTo="/core/fund-transfer/list"
      />
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DualPartyConversionForm } from "@/components/forms/dual-party-form";
import { endpoints } from "@/lib/api/endpoints";

export default function CeftRegisterPage() {
  const t = useTranslations("ceft");
  return (
    <div className="space-y-4">
      <PageHeader title={t("registerTitle")} />
      <DualPartyConversionForm
        endpoint={endpoints.ceft}
        redirectTo="/core/currency-exchange-transfer/list"
      />
    </div>
  );
}

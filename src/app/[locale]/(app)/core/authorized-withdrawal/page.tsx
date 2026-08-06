"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { ApprovalQueue } from "@/components/modules/approval-queue";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { useAuthorizedWithdrawals } from "@/lib/api/hooks";
import { formatAmount, formatPhone } from "@/lib/format";
import type { AuthorizedWithdrawalOperation } from "@/lib/api/types";

export default function AuthorizedWithdrawalPage() {
  const t = useTranslations("authorizedWithdrawal");
  const tf = useTranslations("fields");
  const tw = useTranslations("withdrawal");

  return (
    <ApprovalQueue<AuthorizedWithdrawalOperation>
      title={t("listTitle")}
      amountLabel={tw("amountLabel")}
      registerHref="/core/authorized-withdrawal/register"
      kind="authorized-withdrawals"
      useData={useAuthorizedWithdrawals}
      statIcon={<ShieldCheck className="size-4" aria-hidden />}
      statColor="var(--color-chart-withdrawal)"
      beneficiaryHeader={tf("beneficiary")}
      renderBeneficiaryCell={(row) => (
        <span className="flex flex-col">
          <span className="truncate text-sm text-fg">{row.beneficiary.name}</span>
          {row.beneficiary.phone ? (
            <span className="identifier text-xs text-fg-muted">
              {formatPhone(row.beneficiary.phone)}
            </span>
          ) : null}
        </span>
      )}
      renderBeneficiaryDetail={(row) => (
        <DetailSection title={tf("beneficiary")}>
          <DetailRow label={tf("beneficiaryName")} value={row.beneficiary.name} />
          {row.beneficiary.phone ? (
            <DetailRow
              label={tf("beneficiaryPhone")}
              value={formatPhone(row.beneficiary.phone)}
              identifier
            />
          ) : null}
        </DetailSection>
      )}
      approveTitle={t("approveTitle")}
      approveBody={(row) =>
        t("approveBody", {
          amount: formatAmount(row.amount, row.currency),
          beneficiary: row.beneficiary.name,
        })
      }
      cancelTitle={t("cancelTitle")}
    />
  );
}

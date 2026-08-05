"use client";

import { useTranslations } from "next-intl";
import { ApprovalQueue } from "@/components/modules/approval-queue";
import { DetailRow, DetailSection } from "@/components/shared/detail-drawer";
import { MaskedField } from "@/components/shared/masked-field";
import { useCountries, useExternalTransfers } from "@/lib/api/hooks";
import { formatAmount, formatPhone } from "@/lib/format";
import type { ExternalTransferOperation } from "@/lib/api/types";

export default function ExternalTransferPage() {
  const t = useTranslations("externalTransfer");
  const tf = useTranslations("fields");
  const countries = useCountries();

  const countryName = (code: string) =>
    countries.data?.find((country) => country.code === code)?.name ?? code;

  return (
    <ApprovalQueue<ExternalTransferOperation>
      title={t("listTitle")}
      // §7: the amount column is the amount being transferred, not a balance.
      amountLabel={tf("transferAmount")}
      registerHref="/core/external-transfer/register"
      kind="external-transfers"
      useData={useExternalTransfers}
      beneficiaryHeader={tf("bankName")}
      renderBeneficiaryCell={(row) => (
        <span className="flex min-w-0 flex-col">
          <bdi className="truncate text-sm text-fg">
            {row.beneficiary.bankName}
          </bdi>
          <bdi className="truncate text-xs text-fg-muted">
            {countryName(row.beneficiary.countryCode)} · {row.beneficiary.name}
          </bdi>
          {/* The IBAN is what the transfer is actually settled against, so it
              belongs in the row — masked, with the same audited reveal. */}
          <MaskedField
            value={row.beneficiary.iban}
            fieldName={tf("iban")}
            subjectType="externalTransfer"
            subjectId={row.id}
            format="iban"
            className="text-xs"
          />
        </span>
      )}
      renderBeneficiaryDetail={(row) => (
        <DetailSection title={t("beneficiaryBlock")}>
          <DetailRow label={tf("beneficiaryName")} value={row.beneficiary.name} />
          {row.beneficiary.phone ? (
            <DetailRow
              label={tf("beneficiaryPhone")}
              value={formatPhone(row.beneficiary.phone)}
              numeric
            />
          ) : null}
          <DetailRow
            label={tf("country")}
            value={countryName(row.beneficiary.countryCode)}
          />
          <DetailRow label={tf("bankName")} value={row.beneficiary.bankName} />
          <DetailRow
            label={tf("accountNumber")}
            value={
              <MaskedField
                value={row.beneficiary.accountNumber}
                fieldName={tf("accountNumber")}
                subjectType="externalTransfer"
                subjectId={row.id}
              />
            }
          />
          <DetailRow
            label={tf("iban")}
            value={
              // Masked by default; revealing it is audit-logged.
              <MaskedField
                value={row.beneficiary.iban}
                fieldName={tf("iban")}
                subjectType="externalTransfer"
                subjectId={row.id}
                format="iban"
              />
            }
          />
        </DetailSection>
      )}
      approveTitle={t("approveTitle")}
      approveBody={(row) =>
        t("approveBody", {
          amount: formatAmount(row.amount, row.currency),
          bank: row.beneficiary.bankName,
        })
      }
      cancelTitle={t("cancelTitle")}
    />
  );
}

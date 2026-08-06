"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ClientAccountPicker } from "@/components/shared/client-account-picker";
import { useClientNameText } from "@/components/shared/cells";
import { ConditionalFeeBlock } from "@/components/shared/conditional-fee-block";
import {
  FormWizard,
  ReviewList,
  type WizardStep,
} from "@/components/shared/form-wizard";
import { CountryPicker } from "@/components/shared/country-picker";
import { SelectInput, TextInput, Toggle } from "@/components/ui/field";
import { useBranches, useRegisterOperation } from "@/lib/api/hooks";
import { endpoints } from "@/lib/api/endpoints";
import type { Account } from "@/lib/api/types";
import {
  formatAmount,
  formatIban,
  formatPhone,
  isolate,
  isValidIban,
  isValidPhone,
} from "@/lib/format";

/**
 * External transfers need a full foreign-bank beneficiary block, so they get
 * their own register form rather than the single-workflow template.
 */
export function ExternalTransferForm() {
  const t = useTranslations("fields");
  const clientName = useClientNameText();
  const tv = useTranslations("validation");
  const tSteps = useTranslations("steps");
  const tc = useTranslations("common");
  const tExt = useTranslations("externalTransfer");
  const router = useRouter();

  const branches = useBranches();
  const register = useRegisterOperation(endpoints.externalTransfers);
  const [account, setAccount] = useState<Account | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        clientId: z.string().min(1, tv("required")),
        accountId: z.string().min(1, tv("required")),
        amount: z
          .number({ message: tv("amountPositive") })
          .positive(tv("amountPositive"))
          .refine(
            (value) => !account || value <= account.balance,
            tv("amountExceedsBalance"),
          ),
        branchId: z.string().min(1, tv("required")),
        countryCode: z.string().min(2, tv("required")),
        bankName: z.string().min(2, tv("required")),
        beneficiaryName: z.string().min(2, tv("required")),
        beneficiaryPhone: z
          .string()
          .optional()
          .refine(
            (value) => !value || isValidPhone(value),
            tv("invalidPhone"),
          ),
        beneficiaryAccountNumber: z.string().min(4, tv("required")),
        iban: z.string().refine(isValidIban, tv("invalidIban")),
        feeEnabled: z.boolean(),
        feeType: z.enum(["fixed", "percentage"]),
        feeValue: z.number().min(0),
        smsNotification: z.boolean(),
      }),
    [account, tv],
  );

  type Values = z.infer<typeof schema>;

  /* One object for both readers below. Passing it to `useWatch` as well is
     what makes the subscription return `Values` rather than a partial. */
  const defaults: Values = {
  clientId: "",
  accountId: "",
  amount: 0,
  branchId: "",
  countryCode: "",
  bankName: "",
  beneficiaryName: "",
  beneficiaryPhone: "",
  beneficiaryAccountNumber: "",
  iban: "",
  feeEnabled: false,
  feeType: "fixed",
  feeValue: 0,
  smsNotification: false,
  };

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: defaults,
  });

  /*
   * `useWatch`, not `form.watch()`. The latter returns a fresh function on
   * every render, which the React Compiler cannot memoize, so it bails out of
   * optimising this component entirely — and a wizard re-rendering every field
   * on every keystroke is exactly the component that needed it. `useWatch`
   * subscribes through the control and returns a value.
   */
  // Untargeted, `useWatch` is typed as a deep partial — it cannot know which
  // fields have been registered yet — so the defaults fill the gaps and the
  // reads below stay total.
  const values: Values = { ...defaults, ...useWatch({ control: form.control }) };

  const steps: WizardStep[] = [
    {
      id: "client",
      title: tSteps("clientAccount"),
      validate: () => form.trigger(["clientId", "accountId"]),
      content: (
        <ClientAccountPicker
          value={{ clientId: values.clientId, accountId: values.accountId }}
          onChange={(next, nextAccount) => {
            form.setValue("clientId", next.clientId ?? "", {
              shouldValidate: true,
            });
            form.setValue("accountId", next.accountId ?? "", {
              shouldValidate: true,
            });
            setAccount(nextAccount);
          }}
          error={{
            client: form.formState.errors.clientId?.message,
            account: form.formState.errors.accountId?.message,
          }}
        />
      ),
    },
    {
      id: "amount",
      title: tSteps("amountBranch"),
      validate: () => form.trigger(["amount", "branchId"]),
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <TextInput
                // §7: this is the amount being transferred, not a balance.
                label={t("transferAmount")}
                required
                numeric
                inputMode="decimal"
                value={field.value ? String(field.value) : ""}
                onChange={(event) => field.onChange(Number(event.target.value))}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                hint={
                  account
                    ? `${t("availableBalance")}: ${isolate(
                        formatAmount(account.balance, account.currency),
                      )}`
                    : undefined
                }
              />
            )}
          />
          <SelectInput
            label={t("branch")}
            required
            error={form.formState.errors.branchId?.message}
            {...form.register("branchId")}
          >
            <option value="">{tc("selectPlaceholder")}</option>
            {(branches.data ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </SelectInput>
        </div>
      ),
    },
    {
      id: "beneficiary",
      title: tExt("beneficiaryBlock"),
      validate: () =>
        form.trigger([
          "countryCode",
          "bankName",
          "beneficiaryName",
          "beneficiaryPhone",
          "beneficiaryAccountNumber",
          "iban",
        ]),
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="countryCode"
            render={({ field, fieldState }) => (
              <CountryPicker
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label={t("bankName")}
            required
            error={form.formState.errors.bankName?.message}
            {...form.register("bankName")}
          />
          <TextInput
            label={t("beneficiaryName")}
            required
            error={form.formState.errors.beneficiaryName?.message}
            {...form.register("beneficiaryName")}
          />
          <TextInput
            label={t("beneficiaryPhone")}
            numeric
            inputMode="tel"
            hint={tc("optional")}
            error={form.formState.errors.beneficiaryPhone?.message}
            {...form.register("beneficiaryPhone")}
          />
          <TextInput
            label={t("accountNumber")}
            required
            numeric
            error={form.formState.errors.beneficiaryAccountNumber?.message}
            {...form.register("beneficiaryAccountNumber")}
          />
          <TextInput
            label={t("iban")}
            required
            numeric
            autoComplete="off"
            error={form.formState.errors.iban?.message}
            {...form.register("iban")}
          />
        </div>
      ),
    },
    {
      id: "fee",
      title: tSteps("fee"),
      content: (
        <ConditionalFeeBlock
          value={{
            enabled: values.feeEnabled,
            type: values.feeType,
            value: values.feeValue,
          }}
          baseAmount={values.amount}
          currency={account?.currency}
          onChange={(fee) => {
            form.setValue("feeEnabled", fee.enabled);
            form.setValue("feeType", fee.type);
            form.setValue("feeValue", fee.value);
          }}
        />
      ),
    },
    {
      id: "notification",
      title: tSteps("notification"),
      content: (
        <Toggle
          label={t("smsNotification")}
          checked={values.smsNotification}
          onChange={(checked) => form.setValue("smsNotification", checked)}
        />
      ),
    },
    {
      id: "review",
      title: tSteps("review"),
      content: (
        <ReviewList
          items={[
            {
              label: t("client"),
              value: account
                ? clientName(account.clientName, account.clientNameEn)
                : "—",
            },
            {
              label: t("accountNumber"),
              value: account?.number ?? "—",
              numeric: true,
            },
            {
              label: t("transferAmount"),
              value: account
                ? formatAmount(values.amount, account.currency)
                : String(values.amount),
              numeric: true,
            },
            { label: t("beneficiaryName"), value: values.beneficiaryName || "—" },
            { label: t("bankName"), value: values.bankName || "—" },
            {
              label: t("beneficiaryPhone"),
              value: values.beneficiaryPhone
                ? formatPhone(values.beneficiaryPhone)
                : "—",
              numeric: true,
            },
            {
              label: t("iban"),
              value: values.iban ? formatIban(values.iban) : "—",
              numeric: true,
            },
            ...(values.feeEnabled
              ? [
                  {
                    label: t("fee"),
                    value:
                      values.feeType === "percentage"
                        ? `${values.feeValue}%`
                        : formatAmount(values.feeValue, account?.currency ?? ""),
                    numeric: true,
                  },
                ]
              : []),
            {
              label: t("branch"),
              value:
                (branches.data ?? []).find((b) => b.id === values.branchId)?.name ??
                "—",
            },
            {
              label: t("smsNotification"),
              value: values.smsNotification ? tc("yes") : tc("no"),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <FormWizard
      steps={steps}
      submitting={register.isPending}
      onSubmit={form.handleSubmit(async (data) => {
        await register.mutateAsync({
          accountId: data.accountId,
          amount: data.amount,
          branchId: data.branchId,
          fee: data.feeEnabled
            ? { type: data.feeType, value: data.feeValue }
            : null,
          beneficiary: {
            name: data.beneficiaryName,
            phone: data.beneficiaryPhone || null,
            countryCode: data.countryCode,
            bankName: data.bankName,
            accountNumber: data.beneficiaryAccountNumber,
            iban: data.iban.replace(/\s/g, "").toUpperCase(),
          },
          smsNotification: data.smsNotification,
        });
        router.push("/core/external-transfer");
      })}
    />
  );
}

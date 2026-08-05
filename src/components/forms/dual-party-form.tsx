"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { ClientAccountPicker } from "@/components/shared/client-account-picker";
import { ConditionalFeeBlock } from "@/components/shared/conditional-fee-block";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormWizard, ReviewList, type WizardStep } from "@/components/shared/form-wizard";
import { SelectInput, TextInput, Toggle } from "@/components/ui/field";
import {
  useBranches,
  useExchangeRate,
  useRegisterOperation,
} from "@/lib/api/hooks";
import type { Account } from "@/lib/api/types";
import { formatAmount, formatRate, isolate } from "@/lib/format";

/**
 * Sender/receiver register template.
 *
 * `conversion` turns it into the CEFT variant: a live rate is fetched as soon
 * as both accounts are picked and the converted amount recalculates while the
 * operator types.
 */
export function DualPartyForm({
  endpoint,
  redirectTo,
  conversion = false,
}: {
  endpoint: string;
  redirectTo: string;
  conversion?: boolean;
}) {
  const t = useTranslations("fields");
  const tv = useTranslations("validation");
  const tSteps = useTranslations("steps");
  const tc = useTranslations("common");
  const tft = useTranslations("fundTransfer");
  const tceft = useTranslations("ceft");
  const router = useRouter();

  const branches = useBranches();
  const register = useRegisterOperation(endpoint);
  const [sender, setSender] = useState<Account | null>(null);
  const [receiver, setReceiver] = useState<Account | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rate = useExchangeRate(
    conversion ? sender?.currency : undefined,
    conversion ? receiver?.currency : undefined,
  );

  const schema = useMemo(
    () =>
      z
        .object({
          senderClientId: z.string().min(1, tv("required")),
          senderAccountId: z.string().min(1, tv("required")),
          receiverClientId: z.string().min(1, tv("required")),
          receiverAccountId: z.string().min(1, tv("required")),
          amount: z
            .number({ message: tv("amountPositive") })
            .positive(tv("amountPositive"))
            .refine((value) => !sender || value <= sender.balance, {
              message: tv("amountExceedsBalance"),
            }),
          branchId: z.string().min(1, tv("required")),
          feeEnabled: z.boolean(),
          feeType: z.enum(["fixed", "percentage"]),
          feeValue: z.number().min(0),
          smsNotification: z.boolean(),
        })
        .refine((data) => data.senderAccountId !== data.receiverAccountId, {
          message: tv("sameAccount"),
          path: ["receiverAccountId"],
        }),
    [sender, tv],
  );

  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      senderClientId: "",
      senderAccountId: "",
      receiverClientId: "",
      receiverAccountId: "",
      amount: 0,
      branchId: "",
      feeEnabled: false,
      feeType: "fixed",
      feeValue: 0,
      smsNotification: true,
    },
  });

  const values = form.watch();
  const convertedAmount =
    conversion && rate.data ? values.amount * rate.data.rate : null;

  const steps: WizardStep[] = [
    {
      id: "parties",
      title: tSteps("clientAccount"),
      validate: () =>
        form.trigger([
          "senderClientId",
          "senderAccountId",
          "receiverClientId",
          "receiverAccountId",
        ]),
      content: (
        <div className="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-3 text-sm font-semibold text-fg">
              {tft("senderPanel")}
            </h3>
            <ClientAccountPicker
              value={{
                clientId: values.senderClientId || null,
                accountId: values.senderAccountId || null,
              }}
              onChange={(next, account) => {
                form.setValue("senderClientId", next.clientId ?? "");
                form.setValue("senderAccountId", next.accountId ?? "");
                setSender(account);
              }}
              error={{
                client: form.formState.errors.senderClientId?.message,
                account: form.formState.errors.senderAccountId?.message,
              }}
            />
          </div>

          <div
            aria-hidden
            className="hidden items-center justify-center self-center text-fg-subtle md:flex"
          >
            <ArrowLeft className="rtl-flip size-6" />
          </div>

          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-3 text-sm font-semibold text-fg">
              {tft("receiverPanel")}
            </h3>
            <ClientAccountPicker
              value={{
                clientId: values.receiverClientId || null,
                accountId: values.receiverAccountId || null,
              }}
              onChange={(next, account) => {
                form.setValue("receiverClientId", next.clientId ?? "");
                form.setValue("receiverAccountId", next.accountId ?? "");
                setReceiver(account);
              }}
              // The sender's own account can never be the receiver.
              disabledAccountIds={
                values.senderAccountId ? [values.senderAccountId] : []
              }
              error={{
                client: form.formState.errors.receiverClientId?.message,
                account: form.formState.errors.receiverAccountId?.message,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      id: "amount",
      title: tSteps("amountBranch"),
      validate: () => form.trigger(["amount", "branchId"]),
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <TextInput
                  label={conversion ? t("sentAmount") : t("amount")}
                  required
                  numeric
                  inputMode="decimal"
                  value={field.value === 0 ? "" : String(field.value)}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  hint={
                    sender
                      ? `${t("availableBalance")}: ${isolate(
                          formatAmount(sender.balance, sender.currency),
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

          {conversion ? (
            <div className="rounded-lg border border-border bg-surface-muted p-3">
              {rate.isLoading ? (
                <p className="text-xs text-fg-muted">{tceft("rateLoading")}</p>
              ) : rate.isError || !rate.data ? (
                <p className="text-xs text-danger">{tceft("rateUnavailable")}</p>
              ) : (
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-fg-muted">{tceft("rateApplied")}</dt>
                    <dd className="numeric text-sm font-medium text-fg">
                      {formatRate(rate.data.rate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted">
                      {t("convertedAmount")}
                    </dt>
                    <dd className="numeric text-sm font-semibold text-fg">
                      {receiver
                        ? formatAmount(convertedAmount ?? 0, receiver.currency)
                        : "—"}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          ) : null}
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
          currency={sender?.currency}
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
              label: t("sender"),
              // Name and account number are isolated from each other: the
              // parentheses are neutral, so a Latin number beside an Arabic
              // name would otherwise render with its brackets reversed.
              value: `${isolate(sender?.clientName ?? "—")} (${isolate(
                sender?.number ?? "—",
              )})`,
            },
            {
              label: t("receiver"),
              value: `${receiver?.clientName ?? "—"} (${receiver?.number ?? "—"})`,
            },
            {
              label: conversion ? t("sentAmount") : t("amount"),
              value: sender ? formatAmount(values.amount, sender.currency) : "—",
              numeric: true,
            },
            ...(conversion
              ? [
                  {
                    label: t("convertedAmount"),
                    value: receiver
                      ? formatAmount(convertedAmount ?? 0, receiver.currency)
                      : "—",
                    numeric: true,
                  },
                  {
                    label: t("exchangeRate"),
                    value: rate.data ? formatRate(rate.data.rate) : "—",
                    numeric: true,
                  },
                ]
              : []),
            ...(values.feeEnabled
              ? [
                  {
                    label: t("fee"),
                    value:
                      values.feeType === "percentage"
                        ? `${values.feeValue}%`
                        : formatAmount(values.feeValue, sender?.currency ?? ""),
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
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <FormWizard
        steps={steps}
        submitting={register.isPending}
        onSubmit={form.handleSubmit(() => setConfirmOpen(true))}
      />
      {/* Executes instantly with no reservation step — the dialog is the
          safety net before an irreversible movement of funds. */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={tft("confirmTitle")}
        body={tft("confirmBody")}
        loading={register.isPending}
        onConfirm={async () => {
          const data = form.getValues();
          await register.mutateAsync({
            senderAccountId: data.senderAccountId,
            receiverAccountId: data.receiverAccountId,
            amount: data.amount,
            branchId: data.branchId,
            fee: data.feeEnabled
              ? { type: data.feeType, value: data.feeValue }
              : null,
            smsNotification: data.smsNotification,
            ...(conversion ? { exchangeRate: rate.data?.rate ?? null } : {}),
          });
          setConfirmOpen(false);
          router.push(redirectTo);
        }}
      />
    </>
  );
}

/** CEFT variant: dual-party plus the live FX lookup. */
export function DualPartyConversionForm(props: {
  endpoint: string;
  redirectTo: string;
}) {
  return <DualPartyForm {...props} conversion />;
}

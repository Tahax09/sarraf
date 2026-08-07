"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectInput } from "@/components/ui/field";
import { useBranches, useSaveAccount } from "@/lib/api/hooks";
import { useLabels } from "@/lib/labels";
import type { Account } from "@/lib/api/types";
import { useNotifiedAction } from "@/components/providers/feedback-provider";

/** The account classes the panel may move a record between. */
const ACCOUNT_TYPES = ["current", "savings", "operational", "income"] as const;

/**
 * Edits an account's classification and the branch that keeps it. The number,
 * the IBAN, the currency and the balance are ledger facts: they are shown on
 * the profile page and never offered as inputs here.
 */
export function AccountEditDialog({
  account,
  open,
  onClose,
}: {
  account: Account | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("accounts");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const labels = useLabels();
  const branches = useBranches();
  const save = useSaveAccount();
  const runAction = useNotifiedAction();

  const schema = z.object({
    type: z.string().min(1, tv("required")),
    branchId: z.string().min(1, tv("required")),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: "", branchId: "" },
  });

  const { reset } = form;
  useEffect(() => {
    if (!account) return;
    reset({ type: account.type, branchId: account.branchId });
  }, [account, reset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("edit")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            loading={save.isPending}
            onClick={form.handleSubmit(async (values) => {
              if (!account) return;
              const ok = await runAction(() =>
                save.mutateAsync({ id: account.id, ...values }),
              );
              if (ok) onClose();
            })}
          >
            {tc("save")}
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label={tf("accountType")}
          required
          error={form.formState.errors.type?.message}
          {...form.register("type")}
        >
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {labels.accountType(type)}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          label={tf("branch")}
          required
          error={form.formState.errors.branchId?.message}
          {...form.register("branchId")}
        >
          {(branches.data ?? []).map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </SelectInput>
      </form>
    </Dialog>
  );
}

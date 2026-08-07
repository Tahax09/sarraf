"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { TextInput } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useOperationRules, useSaveOperationRules } from "@/lib/api/hooks";
import { useNotifiedAction } from "@/components/providers/feedback-provider";

export default function OperationRulesPage() {
  const t = useTranslations("operationRules");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");

  const query = useOperationRules();
  const save = useSaveOperationRules();
  const runAction = useNotifiedAction();
  const [saved, setSaved] = useState(false);

  const schema = z.object({
    authorizedWithdrawalExpiryHours: z
      .number({ message: tv("numberPositive") })
      .positive(tv("numberPositive")),
    externalTransferExpiryHours: z
      .number({ message: tv("numberPositive") })
      .positive(tv("numberPositive")),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: query.data,
  });

  // The saved notice is transient — it must not linger as a stale claim.
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(id);
  }, [saved]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <Card className="max-w-2xl">
        {query.isLoading ? (
          <CardBody>
            <Skeleton className="h-24 w-full" />
          </CardBody>
        ) : query.isError ? (
          <CardBody>
            <ErrorState onRetry={() => query.refetch()} />
          </CardBody>
        ) : (
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (await runAction(() => save.mutateAsync(values))) setSaved(true);
            })}
          >
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label={t("authorizedWithdrawalExpiry")}
                required
                numeric
                inputMode="numeric"
                error={
                  form.formState.errors.authorizedWithdrawalExpiryHours?.message
                }
                {...form.register("authorizedWithdrawalExpiryHours", {
                  valueAsNumber: true,
                })}
              />
              <TextInput
                label={t("externalTransferExpiry")}
                required
                numeric
                inputMode="numeric"
                error={form.formState.errors.externalTransferExpiryHours?.message}
                {...form.register("externalTransferExpiryHours", {
                  valueAsNumber: true,
                })}
              />
            </CardBody>
            <CardFooter className="flex items-center justify-between gap-3">
              <p aria-live="polite" className="text-xs text-success">
                {saved ? t("saved") : ""}
              </p>
              <Button type="submit" loading={save.isPending}>
                {tc("save")}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

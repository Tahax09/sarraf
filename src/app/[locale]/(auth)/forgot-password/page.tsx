"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

const schema = z.object({ username: z.string().min(1) });
type Values = z.infer<typeof schema>;

/**
 * Starts a password reset. The backend owns everything that follows — which
 * channel the operator is contacted on, how long the link lives, whether an
 * administrator has to approve it.
 *
 * The confirmation is the same whether or not the account exists, and it is
 * shown even when the request fails: a form that answers differently for a real
 * username is an account directory for anyone who asks it enough times.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const [sent, setSent] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: "" },
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-5">
          <div className="text-center">
            <Logo orientation="vertical" className="mx-auto h-16" decorative />
            <h1 className="mt-3 text-lg font-semibold text-fg">
              {t("forgotTitle")}
            </h1>
            <p className="text-xs text-fg-muted">{tApp("name")}</p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs text-success"
              >
                <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("resetRequested")}
              </p>
              <p className="text-xs text-fg-muted">{t("resetNextSteps")}</p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                await apiFetch<void>(endpoints.passwordResetRequest, {
                  method: "POST",
                  body: values,
                }).catch(() => undefined);
                setSent(true);
              })}
            >
              <p className="text-xs text-fg-muted">{t("forgotDescription")}</p>
              <TextInput
                label={t("username")}
                autoComplete="username"
                required
                autoFocus
                {...form.register("username")}
              />
              <Button
                type="submit"
                className="w-full"
                loading={form.formState.isSubmitting}
              >
                {t("requestResetCta")}
              </Button>
            </form>
          )}

          <p className="text-center">
            <Link href="/login" className="text-xs text-accent hover:underline">
              {t("backToSignIn")}
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}

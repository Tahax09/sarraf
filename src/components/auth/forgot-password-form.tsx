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
import { Turnstile, isTurnstileEnabled } from "@/components/auth/turnstile";
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
 *
 * The same challenge as sign-in guards it, for the reason that identical
 * answers create: a form that cannot be told apart by its response can still be
 * told apart by its side effects, and an unchallenged reset endpoint will send
 * mail to every operator in the directory as fast as a script can ask. The
 * uniform response is the confidentiality control; the challenge is the
 * availability one, and neither substitutes for the other. Rate limiting
 * remains the backend's — the front end cannot enforce it.
 */
export function ForgotPasswordForm({ nonce }: { nonce?: string }) {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const [sent, setSent] = useState(false);
  // One submit's worth of state, never persisted: the token belongs in the
  // request body and nowhere else.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRequired = isTurnstileEnabled();

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
                  body: captchaToken
                    ? { ...values, turnstileToken: captchaToken }
                    : values,
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

              {captchaRequired ? (
                <Turnstile onToken={setCaptchaToken} nonce={nonce} />
              ) : null}

              <Button
                type="submit"
                className="w-full"
                loading={form.formState.isSubmitting}
                // Submitting without a token only produces a rejection the
                // operator cannot act on, so the button waits for the challenge.
                disabled={captchaRequired && !captchaToken}
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

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Info, ShieldCheck } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { PasswordInput, TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Turnstile, isTurnstileEnabled } from "@/components/auth/turnstile";
import { ApiError, apiFetch, usingFixtures } from "@/lib/api/client";
import { secureFlag } from "@/lib/cookies";
import { formatCount } from "@/lib/format";
import { endpoints } from "@/lib/api/endpoints";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

type Credentials = z.infer<typeof credentialsSchema>;

/** Six digits is what every authenticator and SMS gateway in use here emits. */
const OTP_LENGTH = 6;

const otpSchema = z.object({
  code: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`)),
});

type OtpValues = z.infer<typeof otpSchema>;

/**
 * What the backend may answer a sign-in with. Both fields are optional: a
 * deployment without a second factor answers with nothing at all and the
 * operator goes straight through, which is the behaviour this UI had before.
 */
type LoginResult = {
  otpRequired?: boolean;
  /** Identifies the pending sign-in when the code is submitted. */
  challengeId?: string;
} | null;

/**
 * Fixtures mode only. Real sessions are httpOnly cookies set by the backend —
 * this stand-in exists purely so the route guard has something to read while
 * the API is stubbed.
 */
function setFixtureSessionCookie() {
  document.cookie = `saraf_session=fixture; path=/; samesite=lax${secureFlag()}`;
}

/**
 * Why the operator is looking at a sign-in form. The proxy sends `session` when
 * a protected page was opened without a valid session; the user menu sends
 * `signedOut` after a deliberate sign-out. Anything else is ignored rather than
 * rendered — the query string is attacker-controlled input.
 */
function noticeKey(reason: string | null): string | null {
  if (reason === "session") return "sessionEnded";
  if (reason === "signedOut") return "signedOut";
  return null;
}

/**
 * What to tell an operator whose sign-in failed. Credentials and unknown
 * accounts share one message on purpose: which half was wrong is not something
 * a sign-in form should confirm.
 */
function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "networkError";
  if (error.status === 401 || error.status === 403) return "invalidCredentials";
  if (error.status === 423) return "accountLocked";
  if (error.status === 429) return "tooManyAttempts";
  return "signInFailed";
}

export function LoginForm({ nonce }: { nonce?: string }) {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ challengeId?: string } | null>(
    null,
  );
  // Held in component state for the length of one submit and never persisted:
  // the token belongs in the request body and nowhere else.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const notice = noticeKey(searchParams.get("reason"));
  const captchaRequired = isTurnstileEnabled();

  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { username: "", password: "" },
  });

  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const finish = () => {
    if (usingFixtures) setFixtureSessionCookie();
    router.push(searchParams.get("from") ?? "/dashboard");
  };

  const submitCredentials = form.handleSubmit(async (values) => {
    setError(null);
    try {
      // The backend sets an httpOnly session cookie on success.
      const result = await apiFetch<LoginResult>(endpoints.login, {
        method: "POST",
        body: captchaToken ? { ...values, turnstileToken: captchaToken } : values,
      });
      if (result?.otpRequired) {
        setChallenge({ challengeId: result.challengeId });
        return;
      }
      finish();
    } catch (cause) {
      setError(t(errorKey(cause)));
      // A token is single-use; whatever happens next needs a fresh challenge.
      setCaptchaToken(null);
    }
  });

  const submitOtp = otpForm.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiFetch<void>(endpoints.loginOtp, {
        method: "POST",
        body: { ...values, challengeId: challenge?.challengeId },
      });
      finish();
    } catch (cause) {
      setError(
        t(cause instanceof ApiError && cause.status === 401 ? "invalidCode" : errorKey(cause)),
      );
    }
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-5">
          <div className="text-center">
            <Logo orientation="vertical" className="mx-auto h-16" decorative />
            <h1 className="mt-3 text-lg font-semibold text-fg">
              {tApp("name")}
            </h1>
            <p className="text-xs text-fg-muted">{tApp("tagline")}</p>
          </div>

          {notice ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-fg-muted"
            >
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              {t(notice)}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger"
            >
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          {challenge ? (
            <form className="space-y-4" onSubmit={submitOtp}>
              <p className="flex items-start gap-2 text-xs text-fg-muted">
                <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("otpSent")}
              </p>
              <TextInput
                label={t("otpCode")}
                // Numeric, one-time, and never remembered by the browser.
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                numeric
                required
                autoFocus
                error={otpForm.formState.errors.code ? t("invalidCodeFormat") : undefined}
                {...otpForm.register("code")}
              />
              <Button
                type="submit"
                className="w-full"
                loading={otpForm.formState.isSubmitting}
              >
                {t("verifyCta")}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setChallenge(null);
                  setError(null);
                  otpForm.reset();
                }}
                className="w-full text-xs text-fg-muted hover:text-fg"
              >
                {t("useAnotherAccount")}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submitCredentials}>
              <TextInput
                label={t("username")}
                autoComplete="username"
                required
                autoFocus
                {...form.register("username")}
              />
              <PasswordInput
                label={t("password")}
                autoComplete="current-password"
                required
                {...form.register("password")}
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
                {t("signInCta")}
              </Button>

              <p className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-xs text-accent hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </p>
            </form>
          )}

          <p className="text-center text-[11px] text-fg-subtle">
            {t("sessionNotice")}
          </p>

          {/* The sign-in page is outside the shell, so it carries its own. */}
          <p className="text-center text-[11px] text-fg-subtle">
            {tApp("copyright", { year: formatCount(new Date().getFullYear()) })}
          </p>
        </CardBody>
      </Card>
    </main>
  );
}

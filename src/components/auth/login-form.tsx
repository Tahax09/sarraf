"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Info, Phone, ShieldCheck, User } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Logo } from "@/components/shared/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { PasswordInput, PhoneInput, TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Turnstile, isTurnstileEnabled } from "@/components/auth/turnstile";
import { ApiError, apiFetch, usingFixtures } from "@/lib/api/client";
import { safeRedirect } from "@/lib/safe-redirect";
import { secureFlag } from "@/lib/cookies";
import { formatYear, isValidPhone, normalizePhone } from "@/lib/format";
import { endpoints } from "@/lib/api/endpoints";
import loginBanner from "@/assests/Auth/loginbanner.svg";

/**
 * How the operator identifies themselves. Both reach the same account — a
 * branch teller who knows their phone number and not the username the panel
 * issued them should not be locked out over it — and which one was used decides
 * only the field name in the request body.
 */
type SignInMethod = "username" | "phone";

const credentialsSchema = z.object({
  /** A username or a phone number, depending on the method chosen. */
  identifier: z.string().min(1),
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
  const tv = useTranslations("validation");
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

  const [method, setMethod] = useState<SignInMethod>("username");

  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const finish = () => {
    if (usingFixtures) setFixtureSessionCookie();
    router.push(safeRedirect(searchParams.get("from")));
  };

  const submitCredentials = form.handleSubmit(async (values) => {
    setError(null);

    // Checked here rather than in the schema: what makes an identifier valid
    // depends on the method, and the schema is built once.
    if (method === "phone" && !isValidPhone(values.identifier)) {
      form.setError("identifier", { message: tv("invalidPhone") });
      return;
    }

    /*
     * The identifier is sent under the name that says what it is. A phone is
     * normalised first — an operator types it with spaces, a leading zero or a
     * `+218`, and all three are the same number — so the backend matches on one
     * shape instead of guessing at four.
     */
    const credentials =
      method === "phone"
        ? { phone: normalizePhone(values.identifier), password: values.password }
        : { username: values.identifier, password: values.password };

    try {
      // The backend sets an httpOnly session cookie on success.
      const result = await apiFetch<LoginResult>(endpoints.login, {
        method: "POST",
        body: captchaToken
          ? { ...credentials, turnstileToken: captchaToken }
          : credentials,
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
    /*
     * Two panels: what this is, and the way in.
     *
     * The brand side is `hidden lg:flex` — below that width there is no room
     * for two columns, and a phone gets the form alone rather than a headline
     * it has to scroll past. Nothing on the brand side is needed to sign in,
     * so nothing is lost by dropping it.
     *
     * The order is source order, so it mirrors on its own: the brand panel sits
     * on the right in Arabic and the left in English, because a grid column
     * follows the page's direction without being told to.
     */
    <main className="grid min-h-dvh lg:grid-cols-2">
      <BrandPanel />

      <div className="relative flex items-center justify-center bg-bg px-4 py-8">
        {/* Top of the reading edge, above the form: an operator who landed in
            the wrong language needs this before they need anything else. */}
        <LocaleSwitcher className="absolute top-4 end-4" showIcon />

        <div className="w-full max-w-sm space-y-5">
          {/* The logo rides with the form only when the brand panel is gone. */}
          <div className="text-center lg:hidden">
            <Logo orientation="vertical" className="mx-auto h-16" decorative />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-fg">
              {t("welcomeTitle")}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">{t("welcomeSubtitle")}</p>
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
              <SegmentedControl
                segments={[
                  {
                    value: "username",
                    label: t("username"),
                    icon: <User className="size-3.5 shrink-0" aria-hidden />,
                  },
                  {
                    value: "phone",
                    label: t("phone"),
                    icon: <Phone className="size-3.5 shrink-0" aria-hidden />,
                  },
                ]}
                value={method}
                onChange={(next) => {
                  setMethod(next);
                  // The typed value means nothing under the other method, and
                  // an error about it means less.
                  form.setValue("identifier", "");
                  form.clearErrors("identifier");
                  setError(null);
                }}
                ariaLabel={t("signInMethod")}
              />

              {/* `key`: remounting is what clears the browser's autofill and
                  gives the new field the focus, which a swapped label alone
                  does not. */}
              {method === "phone" ? (
                <PhoneInput
                  key="phone"
                  label={t("phone")}
                  placeholder={t("phoneHint")}
                  required
                  autoFocus
                  error={form.formState.errors.identifier?.message}
                  {...form.register("identifier")}
                />
              ) : (
                <TextInput
                  key="username"
                  label={t("username")}
                  autoComplete="username"
                  required
                  autoFocus
                  error={form.formState.errors.identifier?.message}
                  {...form.register("identifier")}
                />
              )}
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

          {/* The brand panel carries the copyright where it is visible; on a
              phone that panel is gone, so the form carries it instead. */}
          <p className="text-center text-[11px] text-fg-subtle lg:hidden">
            <Copyright />
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * The half of the page that says what the operator is signing in to.
 *
 * The artwork is the supplied banner: three blurred colour fields, drawn as
 * vectors rather than the 15 MB export of the same picture, so it costs about a
 * kilobyte and stays sharp at any panel height. It is decorative — `alt=""`,
 * and nothing on this side is needed to sign in — and it sits behind the
 * content rather than beside it, which is why the children are positioned.
 *
 * `object-cover` on a fixed 720×900 drawing means the blobs are cropped, not
 * squashed, whatever shape the column ends up; the composition survives it
 * because there is no subject to lose.
 */
function BrandPanel() {
  const t = useTranslations("auth");

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden border-e border-border bg-surface-muted p-10 lg:flex">
      <Image
        src={loginBanner}
        alt=""
        aria-hidden
        // Above the fold on the one page every session starts at.
        priority
        // The artwork is not symmetric — the heavy field sits low on one side —
        // so it turns with the page like every other directional graphic here,
        // and the weight stays on the same side as the reader's eye.
        className="rtl-flip pointer-events-none absolute inset-0 size-full object-cover"
      />

      <Logo className="relative h-9 w-auto" decorative />

      <div className="relative max-w-md">
        <p className="text-3xl leading-tight font-semibold text-balance text-fg">
          {t("brandHeadline")}
        </p>
        <p className="mt-3 text-sm text-pretty text-fg-muted">
          {t("brandSubcopy")}
        </p>
      </div>

      <p className="relative text-xs text-fg-subtle">
        <Copyright />
      </p>
    </div>
  );
}

/** The sign-in page is outside the shell, so it carries its own footer line. */
function Copyright() {
  const tApp = useTranslations("app");
  return (
    <>{tApp("copyright", { year: formatYear(new Date().getFullYear()) })}</>
  );
}

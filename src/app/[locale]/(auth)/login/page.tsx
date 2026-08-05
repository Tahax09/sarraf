"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiFetch, usingFixtures } from "@/lib/api/client";
import { secureFlag } from "@/lib/cookies";
import { endpoints } from "@/lib/api/endpoints";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

type Values = z.infer<typeof schema>;

/**
 * Fixtures mode only. Real sessions are httpOnly cookies set by the backend —
 * this stand-in exists purely so the route guard has something to read while
 * the API is stubbed.
 */
function setFixtureSessionCookie() {
  document.cookie = `saraf_session=fixture; path=/; samesite=lax${secureFlag()}`;
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tApp = useTranslations("app");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-5">
          <div className="text-center">
            <Logo orientation="vertical" className="mx-auto h-16" decorative />
            <h1 className="mt-3 text-lg font-semibold text-fg">
              {tApp("name")}
            </h1>
            <p className="text-xs text-fg-muted">{tApp("tagline")}</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              setError(null);
              try {
                // The backend sets an httpOnly session cookie on success.
                await apiFetch<void>(endpoints.login, {
                  method: "POST",
                  body: values,
                });
                if (usingFixtures) setFixtureSessionCookie();
                router.push(searchParams.get("from") ?? "/dashboard");
              } catch {
                setError(tc("error"));
              }
            })}
          >
            <TextInput
              label={t("username")}
              autoComplete="username"
              required
              {...form.register("username")}
            />
            <TextInput
              label={t("password")}
              type="password"
              autoComplete="current-password"
              required
              {...form.register("password")}
            />
            {error ? (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              loading={form.formState.isSubmitting}
            >
              {t("signInCta")}
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}

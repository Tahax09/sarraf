"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { errorReference, reportError } from "@/lib/report-error";

/**
 * The fallback every `error.tsx` renders. One component so the recovery
 * affordances — retry, go to dashboard, and a quotable reference — are
 * identical wherever a throw lands.
 *
 * The error message itself is never shown: it may contain backend internals,
 * and an operator cannot act on it. The reference is what support asks for.
 */
export function ErrorPanel({
  error,
  retry,
  boundary,
  /** Fills the viewport when the app shell itself failed to render. */
  fullHeight = false,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  boundary: string;
  fullHeight?: boolean;
}) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  const reference = errorReference(error);

  useEffect(() => {
    reportError(error, { boundary, digest: error.digest });
  }, [error, boundary]);

  return (
    <div
      className={
        fullHeight
          ? "flex min-h-dvh items-center justify-center p-4"
          : "flex items-center justify-center py-16"
      }
    >
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <div>
            {/* role="alert" so a screen reader hears the failure without
                having to discover it by exploring the page. */}
            <h1 role="alert" className="text-base font-semibold text-fg">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">{t("body")}</p>
          </div>
          <p className="numeric rounded-md bg-surface-muted px-2 py-1 text-xs text-fg-subtle">
            {t("reference", { reference })}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={retry}>
              <RotateCcw className="size-4" aria-hidden />
              {tc("retry")}
            </Button>
            <Link
              href="/dashboard"
              className={buttonStyles({ variant: "secondary" })}
            >
              <Home className="size-4" aria-hidden />
              {t("goHome")}
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

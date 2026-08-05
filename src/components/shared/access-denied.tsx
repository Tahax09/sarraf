"use client";

import { useTranslations } from "next-intl";
import { ShieldOff } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Shown when the signed-in role lacks the permission a route requires.
 *
 * It names the module but never the reason a permission was withheld, and it
 * offers no retry — retrying an authorization failure only produces the same
 * answer. The path back is the dashboard, which every authenticated user can
 * reach.
 */
export function AccessDenied({ module }: { module?: string }) {
  const t = useTranslations("errors");
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <ShieldOff className="size-6" aria-hidden />
          </span>
          <div>
            <h1 role="alert" className="text-base font-semibold text-fg">
              {t("deniedTitle")}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">{t("deniedBody")}</p>
            {module ? (
              <p className="mt-2 text-xs text-fg-subtle">
                {t("deniedModule", { module })}
              </p>
            ) : null}
          </div>
          <Link href="/dashboard" className={buttonStyles()}>
            {t("goHome")}
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

import { useTranslations } from "next-intl";
import { FileQuestion } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Shown for an unknown route. A server component: nothing here is interactive
 * beyond a link, so it costs no client JavaScript.
 */
export function NotFoundPanel({ fullHeight = false }: { fullHeight?: boolean }) {
  const t = useTranslations("errors");
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
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
            <FileQuestion className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-semibold text-fg">
              {t("notFoundTitle")}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">{t("notFoundBody")}</p>
          </div>
          <Link href="/dashboard" className={buttonStyles()}>
            {t("goHome")}
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useDashboardSummary } from "@/lib/api/hooks";

/**
 * The two queues that hold money still waiting on a decision. The counts come
 * from the same summary query the KPI bar reads, so the request is shared.
 */
export function AlertsCard() {
  const t = useTranslations("dashboard");
  const summary = useDashboardSummary();

  const authorized = summary.data?.pendingAuthorizedWithdrawals ?? 0;
  const external = summary.data?.pendingExternalTransfers ?? 0;

  const alerts = [
    authorized > 0
      ? {
          href: "/core/authorized-withdrawal",
          text: t("alertPendingAuthorized", { count: authorized }),
        }
      : null,
    external > 0
      ? {
          href: "/core/external-transfer",
          text: t("alertPendingExternal", { count: external }),
        }
      : null,
  ].filter((alert): alert is { href: string; text: string } => alert !== null);

  return (
    <Card>
      <CardHeader title={t("alerts")} />
      <CardBody className="space-y-2">
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            {t("noAlerts")}
          </p>
        ) : (
          alerts.map((alert) => (
            <Link
              key={alert.href}
              href={alert.href}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg hover:bg-surface-muted"
            >
              <AlertTriangle className="size-4 text-warning" aria-hidden />
              {alert.text}
            </Link>
          ))
        )}
      </CardBody>
    </Card>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { useMinuteClock } from "@/lib/clock";
import { diffToParts } from "@/lib/format";

/**
 * Live countdown for pending approvals, driven by the expiry hours configured
 * in Settings → Operation Rules. Rows past their window flag as expired.
 */
export function ExpiryIndicator({
  expiresAt,
  windowHours,
}: {
  expiresAt: string | null;
  /** Total window, used to colour the remaining-time bar. */
  windowHours?: number;
}) {
  const t = useTranslations("expiry");
  // Null until mounted, so SSR output and first paint agree.
  const now = useMinuteClock();

  if (!expiresAt) return null;
  if (!now) return <span className="numeric text-xs text-fg-subtle">—</span>;

  const { past, hours, minutes, totalMinutes } = diffToParts(expiresAt, now);

  if (past) {
    return <Badge tone="warning">{t("expired")}</Badge>;
  }

  const value =
    hours > 0 ? t("hoursMinutes", { hours, minutes }) : t("minutesShort", { minutes });
  const remainingRatio = windowHours
    ? Math.min(1, totalMinutes / (windowHours * 60))
    : null;
  const tone = totalMinutes < 120 ? "danger" : totalMinutes < 360 ? "warning" : "info";

  return (
    <span className="inline-flex flex-col gap-1">
      <Badge tone={tone}>
        <span className="numeric">{t("expiresIn", { value })}</span>
      </Badge>
      {remainingRatio !== null ? (
        <span
          className="h-1 w-20 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(remainingRatio * 100)}
          aria-label={t("expiresIn", { value })}
        >
          <span
            className="block h-full rounded-full"
            style={{
              width: `${remainingRatio * 100}%`,
              backgroundColor:
                tone === "danger"
                  ? "var(--color-danger)"
                  : tone === "warning"
                    ? "var(--color-warning)"
                    : "var(--color-accent)",
            }}
          />
        </span>
      ) : null}
    </span>
  );
}

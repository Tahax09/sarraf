"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
    />
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
          {icon}
        </div>
      ) : null}
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations("common");
  return (
    <EmptyState
      title={t("error")}
      description={t("errorBody")}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t("retry")}
          </Button>
        ) : null
      }
    />
  );
}

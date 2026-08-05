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
  const t = useTranslations("common");
  return (
    <div className="space-y-2 p-4" aria-busy>
      {/* One announcement for the whole block; the bars themselves are
          decorative and stay out of the accessibility tree. */}
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/**
 * Route-level fallback rendered by every `loading.tsx`. It traces the shape
 * every page in this app shares — title, stat bar, then a table or card grid —
 * so the layout does not jump when the real content arrives.
 */
export function PageSkeleton({ stats = 4 }: { stats?: number }) {
  const t = useTranslations("common");
  return (
    <div className="space-y-4" aria-busy>
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: stats }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="rounded-card border border-border">
        <TableSkeletonBars rows={8} />
      </div>
    </div>
  );
}

/** Bars only — `PageSkeleton` already owns the status announcement. */
function TableSkeletonBars({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 p-4">
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

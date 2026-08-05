"use client";

import type { ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Row expand-on-click panel. Houses raw IDs, fee breakdowns, beneficiary
 * details and anything else deliberately kept out of the collapsed row.
 * Side panel from `sm` up, full-screen sheet on mobile (handled by Dialog).
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      variant="sheet"
    >
      {children}
    </Dialog>
  );
}

export function DetailSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-5 last:mb-0", className)}>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">
        {title}
      </h3>
      <dl className="divide-y divide-border rounded-lg border border-border">
        {children}
      </dl>
    </section>
  );
}

export function DetailRow({
  label,
  value,
  numeric,
}: {
  label: ReactNode;
  value: ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2.5">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-end text-sm break-words text-fg",
          numeric && "numeric",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

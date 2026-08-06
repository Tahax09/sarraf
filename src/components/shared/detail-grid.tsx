import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Record fields laid out for a page, not a drawer.
 *
 * The drawer's `DetailSection` draws its own bordered, row-divided box, which is
 * right in a 380px panel and wrong inside a card: the card already has a border,
 * so the box reads as a second table nested in the first. Here the card supplies
 * the frame and the fields are a plain definition grid — label above value,
 * columns as the width allows.
 */
export function DetailGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function DetailItem({
  label,
  value,
  numeric,
  /** Long values — an IBAN, an address — take the full row instead of a column. */
  wide,
}: {
  label: ReactNode;
  value: ReactNode;
  numeric?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 lg:col-span-3")}>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={cn("mt-1 text-sm break-words text-fg", numeric && "numeric")}>
        {/*
         * `<bdi>` for the same reason the drawer uses it: every value is record
         * data — an IBAN, a reference, a Latin name — read against an Arabic
         * label, and each needs its own direction without dragging the column
         * with it.
         */}
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}

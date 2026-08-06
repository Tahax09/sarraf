import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
      // Hook for the print stylesheet: a card must not be split across a page
      // fold, and it loses its shadow on paper. Set after the spread so it is
      // on every card — the printed layout does not depend on a caller.
      data-card=""
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg sm:text-base">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
        ) : null}
      </div>
      {/* `shrink-0` keeps a long title from squeezing the action; `max-w-full`
          stops the same rule from pushing a wide action (a row of legend
          chips, say) past the card on a phone — capped, it wraps instead. */}
      {action ? <div className="max-w-full shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

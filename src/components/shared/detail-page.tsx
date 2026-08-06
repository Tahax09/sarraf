import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The layout language for every record page in the panel — one account, one
 * client, one operation.
 *
 * A record page is not a register with a single row. It reads top to bottom:
 * who this is (`RecordHeader`), the few figures that matter (a stat row), then
 * plain titled sections of fields (`RecordSection` + `DetailGrid`), then the
 * related records. Nothing here draws a box inside a box: the section's card is
 * the only frame, and the fields inside it are a definition grid, not a table.
 */

/**
 * Identity band. Says what the record is before it says anything about it: an
 * icon that names the kind, the record's own identifier as the heading, and the
 * one or two facts an operator uses to confirm they opened the right one.
 */
export function RecordHeader({
  icon,
  eyebrow,
  title,
  /** Status badges and the like — rendered inline after the title. */
  badges,
  meta,
  actions,
}: {
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  /** Secondary facts, each already formatted; separated by a thin divider. */
  meta?: ReactNode[];
  actions?: ReactNode;
}) {
  const facts = (meta ?? []).filter(Boolean);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-card border border-border bg-surface-muted text-fg-muted"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-xl font-semibold break-words text-fg sm:text-2xl">
              {/* The heading is usually record data — an account number, a Latin
                  client name — under an Arabic eyebrow, so it gets its own
                  direction without dragging the block with it. */}
              <bdi>{title}</bdi>
            </h1>
            {badges}
          </div>
          {facts.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
              {facts.map((fact, index) => (
                <span key={index} className="flex items-center gap-3">
                  {index > 0 ? (
                    <span aria-hidden className="h-3 w-px bg-border" />
                  ) : null}
                  <bdi className="min-w-0">{fact}</bdi>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/**
 * One titled block of a record page.
 *
 * `flush` drops the body padding for sections whose content brings its own — a
 * table, chiefly. Without it a `DataTable` would sit inset inside the card and
 * read as a second panel.
 */
export function RecordSection({
  title,
  description,
  action,
  flush,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} action={action} />
      {flush ? children : <CardBody>{children}</CardBody>}
    </Card>
  );
}

/**
 * Record fields laid out for a page, not a drawer.
 *
 * The drawer's `DetailSection` draws its own bordered, row-divided box, which is
 * right in a 380px panel and wrong inside a card: the card already has a border,
 * so the box reads as a second table nested in the first. Here the section
 * supplies the frame and the fields are a plain definition grid — label above
 * value, columns as the width allows.
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
        "grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3",
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
  /** Sits under the value: a unit, a qualifier, the thing the figure counts. */
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  numeric?: boolean;
  wide?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 lg:col-span-3")}>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd
        className={cn("mt-1 text-sm break-words text-fg", numeric && "numeric")}
      >
        {/*
         * `<bdi>` for the same reason the drawer uses it: every value is record
         * data — an IBAN, a reference, a Latin name — read against an Arabic
         * label, and each needs its own direction without dragging the column
         * with it.
         */}
        <bdi>{value}</bdi>
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-fg-subtle">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

"use client";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { DensityToggle, useDensity } from "./table-density";

/**
 * Page control. The label is always on the button (never on the glyph alone),
 * so a screen reader hears "page 3" rather than an unlabelled chevron.
 */
function PageButton({
  label,
  current,
  disabled,
  onClick,
  children,
}: {
  label: string;
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(
        "min-w-8 rounded-md border px-2 py-1 text-xs transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-40",
        current
          ? "border-accent bg-accent text-accent-fg"
          : "border-border text-fg-muted hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

/** `1 … 4 5 6 … 247` — first, last, and a window around the current page. */
export function pageWindow(page: number, count: number): (number | "gap")[] {
  if (count <= 7) {
    return Array.from({ length: count }, (_, index) => index + 1);
  }
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  const pages: (number | "gap")[] = [1];
  if (start > 2) pages.push("gap");
  for (let index = start; index <= end; index += 1) pages.push(index);
  if (end < count - 1) pages.push("gap");
  pages.push(count);
  return pages;
}

/**
 * The bar under a paged register: how many rows per page, which rows are on
 * screen, how tall they are, and the pages themselves.
 *
 * It reads the density store directly rather than taking density as a prop —
 * the toggle and the rows it governs are the only two readers, and passing the
 * value down through the table only to hand it back would make the table an
 * intermediary in a preference it does not own.
 */
export function TablePager({
  page,
  pageCount,
  pageSize,
  pageSizes,
  rangeLabel,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizes: readonly number[];
  /** Already localised: "showing 11–20 of 36". Announced elsewhere too. */
  rangeLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const t = useTranslations("common");
  const tt = useTranslations("table");
  const pageSizeId = useId();
  const [density, setDensity] = useDensity();

  return (
    <nav
      aria-label={tt("pagination")}
      // Not sticky: with `scroll` the rows are bounded and the pager already
      // sits under whatever the reader can see, and pinning it to the viewport
      // only covered the last row of every other register.
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-3 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={pageSizeId} className="text-xs text-fg-muted">
          {tt("rowsPerPage")}
        </label>
        <select
          id={pageSizeId}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="numeric rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
        >
          {pageSizes.map((option) => (
            <option key={option} value={option}>
              {formatCount(option)}
            </option>
          ))}
        </select>
        <span className="numeric text-xs text-fg-subtle">{rangeLabel}</span>
        <DensityToggle density={density} onChange={setDensity} />
      </div>

      {/* Wraps: at 320px a nine-page window plus both arrows is wider than the
          screen, and a pager that scrolls sideways is a pager the reader never
          finds. */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        <PageButton
          label={t("previous")}
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <span aria-hidden>‹</span>
        </PageButton>
        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span
              key={`gap-${index}`}
              aria-hidden
              className="px-1 text-xs text-fg-subtle"
            >
              …
            </span>
          ) : (
            <PageButton
              key={entry}
              label={tt("page", { page: formatCount(entry) })}
              current={entry === page}
              onClick={() => onPageChange(entry)}
            >
              <span className="numeric">{formatCount(entry)}</span>
            </PageButton>
          ),
        )}
        <PageButton
          label={t("next")}
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <span aria-hidden>›</span>
        </PageButton>
      </div>
    </nav>
  );
}

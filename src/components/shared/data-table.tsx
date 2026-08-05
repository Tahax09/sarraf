"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { DetailDrawer } from "./detail-drawer";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Rendered as the card heading in the small-screen fallback. */
  primary?: boolean;
  align?: "start" | "end";
  /** Hidden entirely — used for fee columns when no row carries a fee. */
  hidden?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  /** Omit from the mobile card body (e.g. the actions column, rendered apart). */
  hideOnCard?: boolean;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** Detail-drawer content. Raw IDs and secondary fields belong here. */
  renderDetail?: (row: T) => ReactNode;
  detailTitle?: (row: T) => ReactNode;
  /** Row-level actions, rendered in a trailing cell and on the mobile card. */
  renderActions?: (row: T) => ReactNode;
  /** Off for embedded preview tables (dashboard, reports) that show a fixed few. */
  paginate?: boolean;
  /** Initial rows per page; the reader switches between `pageSizeOptions`. */
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Leading row-number column. On whenever the table paginates. */
  numbered?: boolean;
  /**
   * Escape hatch for a long `paginate={false}` table: renders only the rows in
   * view. A paginated table never mounts more than one page, so it needs none.
   */
  virtualize?: boolean;
  rowHeight?: number;
  caption?: string;
};

const DEFAULT_PAGE_SIZES = [10, 20, 25, 50];

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
function pageWindow(page: number, count: number): (number | "gap")[] {
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

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  renderDetail,
  detailTitle,
  renderActions,
  paginate = true,
  pageSize: initialPageSize = DEFAULT_PAGE_SIZES[0],
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  numbered = paginate,
  virtualize = false,
  rowHeight = 52,
  caption,
}: DataTableProps<T>) {
  const t = useTranslations("common");
  const tt = useTranslations("table");
  const [selected, setSelected] = useState<T | null>(null);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [requestedPage, setRequestedPage] = useState(1);
  const [seenTotal, setSeenTotal] = useState(rows.length);
  const pageSizeId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !c.hidden),
    [columns],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    enabled: virtualize && !paginate,
  });

  // A filter or a tab change replaces the row set: go back to the first page
  // rather than stranding the reader on a page that no longer exists.
  if (seenTotal !== rows.length) {
    setSeenTotal(rows.length);
    setRequestedPage(1);
  }

  const pageCount = paginate ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const page = Math.min(requestedPage, pageCount);
  const offset = paginate ? (page - 1) * pageSize : 0;
  const pageRows = paginate ? rows.slice(offset, offset + pageSize) : rows;

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? t("empty")}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const openable = Boolean(renderDetail);
  const virtualRows =
    virtualize && !paginate ? virtualizer.getVirtualItems() : null;

  return (
    <>
      {/* Desktop / tablet: real table. */}
      <div
        ref={scrollRef}
        className={cn(
          "hidden md:block",
          virtualize ? "max-h-[70vh] overflow-auto" : "overflow-x-auto",
        )}
      >
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr>
              {numbered ? (
                <th
                  scope="col"
                  className="w-12 border-b border-border px-3 py-2.5 text-start text-xs font-medium text-fg-muted"
                >
                  {tt("rowNumber")}
                </th>
              ) : null}
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "border-b border-border px-3 py-2.5 text-xs font-medium text-fg-muted",
                    col.align === "end" ? "text-end" : "text-start",
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
              {renderActions ? (
                <th
                  scope="col"
                  className="border-b border-border px-3 py-2.5 text-end text-xs font-medium text-fg-muted"
                >
                  {t("actions")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody
            style={
              virtualRows
                ? { height: virtualizer.getTotalSize(), position: "relative" }
                : undefined
            }
          >
            {(virtualRows ?? pageRows.map((_, index) => ({ index, start: 0, key: index }))).map(
              (virtualRow) => {
                const row = (virtualRows ? rows : pageRows)[virtualRow.index];
                return (
                  <tr
                    key={getRowId(row)}
                    className={cn(
                      "border-b border-border last:border-0",
                      openable && "cursor-pointer hover:bg-surface-muted",
                    )}
                    style={
                      virtualRows
                        ? {
                            position: "absolute",
                            insetInlineStart: 0,
                            width: "100%",
                            display: "flex",
                            transform: `translateY(${virtualRow.start}px)`,
                            height: rowHeight,
                          }
                        : undefined
                    }
                    onClick={
                      openable ? () => setSelected(row) : undefined
                    }
                    onKeyDown={
                      openable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelected(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={openable ? 0 : undefined}
                    aria-label={openable ? t("expandRow") : undefined}
                  >
                    {numbered ? (
                      <td
                        className={cn(
                          "numeric px-3 py-3 align-middle text-xs text-fg-subtle",
                          virtualRows && "flex-1",
                        )}
                      >
                        {/* Continues across pages: page 2 starts at 16. */}
                        {formatCount(offset + virtualRow.index + 1)}
                      </td>
                    ) : null}
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-3 align-middle text-fg",
                          virtualRows && "flex-1",
                          col.align === "end" ? "text-end" : "text-start",
                          col.cellClassName,
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                    {renderActions ? (
                      <td
                        className={cn(
                          "px-3 py-2 text-end",
                          virtualRows && "flex-1",
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {renderActions(row)}
                      </td>
                    ) : null}
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>

      {/* Small screens: stacked cards. A 5–16 column table cannot usefully
          scroll sideways on a phone, and approvals happen on phones. */}
      <ul className="divide-y divide-border md:hidden">
        {pageRows.map((row, index) => {
          const primary = visibleColumns.find((c) => c.primary);
          const rest = visibleColumns.filter((c) => !c.primary && !c.hideOnCard);
          return (
            <li key={getRowId(row)} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2 text-sm font-medium text-fg">
                  {numbered ? (
                    <span className="numeric shrink-0 text-xs font-normal text-fg-subtle">
                      {formatCount(offset + index + 1)}
                    </span>
                  ) : null}
                  {primary ? <span className="min-w-0">{primary.cell(row)}</span> : null}
                </div>
                {renderActions ? (
                  <div className="shrink-0">{renderActions(row)}</div>
                ) : null}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {rest.map((col) => (
                  <div key={col.key} className="min-w-0">
                    <dt className="text-[11px] text-fg-subtle">{col.header}</dt>
                    <dd className="truncate text-xs text-fg">{col.cell(row)}</dd>
                  </div>
                ))}
              </dl>
              {openable ? (
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="mt-3 text-xs font-medium text-accent"
                >
                  {t("expandRow")}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {paginate && rows.length > pageSizeOptions[0] ? (
        <nav
          aria-label={tt("pagination")}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3"
        >
          <div className="flex items-center gap-2">
            <label
              htmlFor={pageSizeId}
              className="text-xs text-fg-muted"
            >
              {tt("rowsPerPage")}
            </label>
            <select
              id={pageSizeId}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setRequestedPage(1);
              }}
              className="numeric rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {formatCount(option)}
                </option>
              ))}
            </select>
            <span className="numeric text-xs text-fg-subtle">
              {tt("range", {
                from: formatCount(offset + 1),
                to: formatCount(offset + pageRows.length),
                total: formatCount(rows.length),
              })}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <PageButton
              label={t("previous")}
              disabled={page === 1}
              onClick={() => setRequestedPage(page - 1)}
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
                  onClick={() => setRequestedPage(entry)}
                >
                  <span className="numeric">{formatCount(entry)}</span>
                </PageButton>
              ),
            )}
            <PageButton
              label={t("next")}
              disabled={page === pageCount}
              onClick={() => setRequestedPage(page + 1)}
            >
              <span aria-hidden>›</span>
            </PageButton>
          </div>
        </nav>
      ) : null}

      {renderDetail ? (
        <DetailDrawer
          open={selected !== null}
          onClose={() => setSelected(null)}
          title={
            selected && detailTitle ? detailTitle(selected) : t("details")
          }
        >
          {selected ? renderDetail(selected) : null}
        </DetailDrawer>
      ) : null}
    </>
  );
}

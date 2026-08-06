"use client";

import {
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsUpDown, Rows2, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { createRecordStore } from "@/lib/local-store";
import { PAGE_SIZES, nextSort } from "@/lib/use-table-query";
import type { SortState } from "@/lib/api/types";
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
  /**
   * Present means the header is a sort control; `true` means "order by this
   * column's own key". When the caller passes `onSortChange` this is the field
   * name the backend orders by; otherwise the table orders the rows it holds.
   */
  sortKey?: string | true;
  /**
   * What to compare when the table sorts its own rows. Needed only when the
   * column shows something the row does not carry under `sortKey` — a computed
   * total, a nested field, or a label looked up from a code.
   */
  sortValue?: (row: T) => string | number | null | undefined;
};

/**
 * Server-side paging. Supplying this hands the table the authoritative record
 * count and puts the caller in charge of fetching — the table then renders the
 * rows it was given and never slices them.
 */
export type ServerPaging = {
  page: number;
  pageSize: number;
  /** Every matching record, not just the ones on this page. */
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

/**
 * How a register pages. Every table states one of the three, and none of them
 * is a default.
 *
 * This used to be two optional props, one of which defaulted to on, so a
 * register's paging came from what its author had not written: nine tables
 * paged in the browser because nobody had said otherwise, and nine opted out
 * with `paginate={false}` — two spellings, one of them silent, for a decision
 * that depends on which endpoint the rows came from. One required prop puts
 * that decision in the diff, where a reviewer can disagree with it.
 *
 * - a `ServerPaging` object — the endpoint returns `Paged<T>`, so the register
 *   holds one page and the pager asks for the next.
 * - `"client"` — the endpoint returns the whole set and the table pages it
 *   here. A property of the endpoint rather than a preference:
 *   `docs/adr/0004-table-pagination.md` lists which endpoints are still
 *   whole-set and what changes at a call site when one of them starts paging.
 * - `"none"` — the set is bounded by the contract: a seven-day breakdown, a top
 *   ten, the sessions of one account. Every row is on screen because every row
 *   fits.
 */
export type Paging = ServerPaging | "client" | "none";

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
  /**
   * Actions pinned to the bottom of the drawer — "open the full record",
   * "edit". `close` dismisses the drawer, so an action that opens a dialog of
   * its own does not stack two modals on top of each other.
   */
  detailFooter?: (row: T, close: () => void) => ReactNode;
  /** Row-level actions, rendered in a trailing cell and on the mobile card. */
  renderActions?: (row: T) => ReactNode;
  /** Required: see `Paging`. Which of the three a register uses is a decision. */
  paging: Paging;
  /** Initial rows per page in `"client"` mode; the reader picks from `PAGE_SIZES`. */
  pageSize?: number;
  /** Leading row-number column. On whenever the table paginates. */
  numbered?: boolean;
  /**
   * Ordering owned by the caller, because the backend does the ordering. Leave
   * both out and any column with a `sortKey` still sorts — the table keeps the
   * state and orders the rows it was handed, which is what a register that
   * arrives whole needs.
   */
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  caption?: string;
  /**
   * Bounds the table to a scrolling viewport instead of letting it run the
   * length of the page. Registers with a page of rows read fine as they are;
   * the ledger does not, and its header and pager have to stay reachable.
   */
  scroll?: boolean;
};

const DEFAULT_PAGE_SIZES = [...PAGE_SIZES];

/**
 * Orders the rows the table was handed, for registers that arrive whole.
 *
 * Numbers compare as numbers and everything else through a collator for the
 * language on screen, which is what makes an Arabic name register sort the way
 * an Arabic reader expects rather than by code point. ISO timestamps sort
 * correctly as strings, so dates need nothing of their own.
 *
 * Blanks sort last in both directions. A row missing the value is not "before
 * everything" — it is the row with nothing to say, and it belongs at the end
 * whichever way the column is pointing.
 */
function sortRows<T>(
  rows: T[],
  sort: SortState,
  columns: Column<T>[],
  locale: string,
): T[] {
  if (!sort) return rows;
  const column = columns.find(
    (col) => (col.sortKey === true ? col.key : col.sortKey) === sort.key,
  );
  const read = (row: T) =>
    column?.sortValue
      ? column.sortValue(row)
      : (row as Record<string, unknown>)[sort.key];

  const collator = new Intl.Collator(locale, { numeric: true });
  const factor = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const left = read(a);
    const right = read(b);
    const leftEmpty = left === null || left === undefined || left === "";
    const rightEmpty = right === null || right === undefined || right === "";
    if (leftEmpty || rightEmpty) {
      return leftEmpty && rightEmpty ? 0 : leftEmpty ? 1 : -1;
    }
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }
    return collator.compare(String(left), String(right)) * factor;
  });
}

export type Density = "comfortable" | "compact";

/**
 * Row height, shared by every register for the session.
 *
 * It is a display preference, not data: an operator scanning the ledger for one
 * reference wants as many rows on screen as will fit, while one reading a day's
 * approvals wants room between them. Stored so the choice survives moving
 * between registers, and session-scoped like every other view preference here.
 */
const densityStore = createRecordStore("saraf.table");

function useDensity(): [Density, (next: Density) => void] {
  const values = useSyncExternalStore(
    densityStore.subscribe,
    densityStore.getSnapshot,
    densityStore.getServerSnapshot,
  );
  const density: Density =
    values.density === "compact" ? "compact" : "comfortable";
  const set = (next: Density) =>
    densityStore.set({ ...densityStore.getSnapshot(), density: next });
  return [density, set];
}

/** Labelled with the state it switches to, so the button says what it does. */
function DensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (next: Density) => void;
}) {
  const tt = useTranslations("table");
  const compact = density === "compact";
  const Icon = compact ? Rows2 : Rows3;
  return (
    <button
      type="button"
      onClick={() => onChange(compact ? "comfortable" : "compact")}
      className={cn(
        "hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs md:inline-flex",
        "text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {compact ? tt("densityComfortable") : tt("densityCompact")}
    </button>
  );
}

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

/** Column header that doubles as a sort control. */
function SortableHeader({
  active,
  direction,
  label,
  onClick,
  children,
}: {
  active: boolean;
  direction: "asc" | "desc";
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm text-xs font-medium",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active ? "text-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      {children}
      {/*
       * The column name stays in the button's accessible name and the action is
       * appended to it. As an `aria-label` the action replaced the name, so a
       * screen reader announced a row of buttons all called "sort ascending"
       * with nothing to say which column each one ordered.
       */}
      <span className="sr-only">{label}</span>
      <Icon className="size-3.5 shrink-0" aria-hidden />
    </button>
  );
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
  detailFooter,
  renderActions,
  paging,
  pageSize: initialPageSize = DEFAULT_PAGE_SIZES[0],
  numbered,
  sort = null,
  onSortChange,
  caption,
  scroll = false,
}: DataTableProps<T>) {
  const t = useTranslations("common");
  const tt = useTranslations("table");
  const locale = useLocale();
  const [selected, setSelected] = useState<T | null>(null);
  const [clientPageSize, setClientPageSize] = useState(initialPageSize);
  const [requestedPage, setRequestedPage] = useState(1);
  const [seenTotal, setSeenTotal] = useState(rows.length);
  const pageSizeId = useId();

  const server = typeof paging === "object" ? paging : null;
  const [density, setDensity] = useDensity();
  const compact = density === "compact";
  const headCell = compact ? "px-3 py-1.5" : "px-3 py-2.5";
  const bodyCell = compact ? "px-3 py-1.5" : "px-3 py-3";
  const paged = server !== null || paging === "client";
  const showNumbers = numbered ?? paged;

  const visibleColumns = useMemo(
    () => columns.filter((c) => !c.hidden),
    [columns],
  );

  /*
   * Who does the ordering.
   *
   * A register that pages on the server has to sort there too — page 3 of an
   * unsorted set reordered in the browser is three pages of nonsense — so when
   * the caller passes `onSortChange` the table only reports the click.
   *
   * Everything else arrives whole: settings registers, a client's accounts, the
   * rows behind a dashboard card. Those used to have no sorting at all, because
   * wiring each one to a query it does not make was more than the feature was
   * worth. The table sorts them itself instead, off the same `sortKey` the
   * server-backed columns declare, so a column becomes sortable by saying so
   * once and the page does not care which half of the arrangement it is in.
   */
  const serverSorted = Boolean(onSortChange);
  const [localSort, setLocalSort] = useState<SortState>(null);
  const activeSort = serverSorted ? sort : localSort;
  const applySort = onSortChange ?? setLocalSort;

  const orderedRows = useMemo(
    () =>
      serverSorted ? rows : sortRows(rows, localSort, visibleColumns, locale),
    [serverSorted, rows, localSort, visibleColumns, locale],
  );

  // In client mode a filter or tab change replaces the row set: go back to the
  // first page rather than stranding the reader on one that no longer exists.
  // Server mode owns its own page number, so it is left alone.
  if (server === null && seenTotal !== rows.length) {
    setSeenTotal(rows.length);
    setRequestedPage(1);
  }

  const total = server ? server.total : rows.length;
  const pageSize = server ? server.pageSize : clientPageSize;
  const pageCount = paged ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const page = server ? server.page : Math.min(requestedPage, pageCount);
  const offset = paged ? (page - 1) * pageSize : 0;
  // The server already sent exactly one page; only client mode slices.
  const pageRows =
    paging === "client"
      ? orderedRows.slice(offset, offset + pageSize)
      : orderedRows;

  const goToPage = (next: number) => {
    if (server) server.onPageChange(next);
    else setRequestedPage(next);
  };

  const changePageSize = (next: number) => {
    if (server) server.onPageSizeChange(next);
    else {
      setClientPageSize(next);
      setRequestedPage(1);
    }
  };

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (total === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? t("empty")}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const openable = Boolean(renderDetail);
  const sortableColumn = (col: Column<T>) =>
    col.sortKey === true ? col.key : col.sortKey;

  const rangeLabel = tt("range", {
    from: formatCount(offset + 1),
    to: formatCount(offset + pageRows.length),
    total: formatCount(total),
  });

  return (
    <>
      {/* One announcement covers both layouts: which records are on screen, and
          how many exist in total. */}
      <p aria-live="polite" className="sr-only">
        {rangeLabel}
      </p>

      {/* Desktop / tablet: real table. */}
      <div
        className={cn(
          "hidden overflow-x-auto md:block",
          // The sticky header only sticks against a scroll container; without a
          // bound it is the page that scrolls and the header leaves with it.
          scroll && "max-h-[65vh]",
        )}
      >
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr>
              {showNumbers ? (
                <th
                  scope="col"
                  className={cn(
                    "w-12 border-b border-border text-start text-xs font-medium text-fg-muted",
                    headCell,
                  )}
                >
                  {tt("rowNumber")}
                </th>
              ) : null}
              {visibleColumns.map((col) => {
                const sortKey = sortableColumn(col);
                const active = Boolean(sortKey) && activeSort?.key === sortKey;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      !sortKey
                        ? undefined
                        : active
                          ? activeSort?.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                    }
                    className={cn(
                      "border-b border-border text-xs font-medium text-fg-muted",
                      headCell,
                      col.align === "end" ? "text-end" : "text-start",
                      col.headerClassName,
                    )}
                  >
                    {sortKey ? (
                      <SortableHeader
                        active={active}
                        direction={activeSort?.direction ?? "asc"}
                        label={
                          active && activeSort?.direction === "asc"
                            ? tt("sortDesc")
                            : tt("sortAsc")
                        }
                        onClick={() => applySort(nextSort(activeSort, sortKey))}
                      >
                        {col.header}
                      </SortableHeader>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {renderActions ? (
                <th
                  scope="col"
                  className={cn(
                    "border-b border-border text-end text-xs font-medium text-fg-muted",
                    headCell,
                  )}
                >
                  {t("actions")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr
                key={getRowId(row)}
                className={cn(
                  "border-b border-border last:border-0",
                  openable && "cursor-pointer hover:bg-surface-muted",
                )}
                onClick={openable ? () => setSelected(row) : undefined}
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
                {showNumbers ? (
                  <td
                    className={cn(
                      "numeric align-middle text-xs text-fg-subtle",
                      bodyCell,
                    )}
                  >
                    {/* Continues across pages: page 2 starts at 11. */}
                    {formatCount(offset + index + 1)}
                  </td>
                ) : null}
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "align-middle text-fg",
                      bodyCell,
                      col.align === "end" ? "text-end" : "text-start",
                      col.cellClassName,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
                {renderActions ? (
                  <td
                    className={cn("text-end", compact ? "px-3 py-1" : "px-3 py-2")}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderActions(row)}
                  </td>
                ) : null}
              </tr>
            ))}
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
            <li key={getRowId(row)} className={compact ? "p-3" : "p-4"}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2 text-sm font-medium text-fg">
                  {showNumbers ? (
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
                  // `min-h-6` + padding: this is the card fallback's only tap
                  // target, and 11px type alone leaves it under the 24px WCAG
                  // 2.5.8 minimum.
                  className="-mx-1 mt-2 inline-flex min-h-6 items-center rounded-md px-1 text-xs font-medium text-accent"
                >
                  {t("expandRow")}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* The pager appears whenever more records exist than the smallest page
          size — in server mode that is judged on `total`, so a second page can
          never hide behind a full first one. */}
      {paged && total > DEFAULT_PAGE_SIZES[0] ? (
        <nav
          aria-label={tt("pagination")}
          // Not sticky: with `scroll` the rows are bounded and the pager already
          // sits under whatever the reader can see, and pinning it to the
          // viewport only covered the last row of every other register.
          className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-3 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={pageSizeId} className="text-xs text-fg-muted">
              {tt("rowsPerPage")}
            </label>
            <select
              id={pageSizeId}
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
              className="numeric rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
            >
              {DEFAULT_PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {formatCount(option)}
                </option>
              ))}
            </select>
            <span className="numeric text-xs text-fg-subtle">{rangeLabel}</span>
            <DensityToggle density={density} onChange={setDensity} />
          </div>

          {/* Wraps: at 320px a nine-page window plus both arrows is wider than
              the screen, and a pager that scrolls sideways is a pager the
              reader never finds. */}
          <div className="flex flex-wrap items-center justify-end gap-1">
            <PageButton
              label={t("previous")}
              disabled={page === 1}
              onClick={() => goToPage(page - 1)}
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
                  onClick={() => goToPage(entry)}
                >
                  <span className="numeric">{formatCount(entry)}</span>
                </PageButton>
              ),
            )}
            <PageButton
              label={t("next")}
              disabled={page === pageCount}
              onClick={() => goToPage(page + 1)}
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
          title={selected && detailTitle ? detailTitle(selected) : t("details")}
          footer={
            selected && detailFooter
              ? detailFooter(selected, () => setSelected(null))
              : undefined
          }
        >
          {selected ? renderDetail(selected) : null}
        </DetailDrawer>
      ) : null}
    </>
  );
}

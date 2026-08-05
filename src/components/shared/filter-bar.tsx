"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectInput, TextInput } from "@/components/ui/field";
import { filterKeys, type FilterDef, type FilterState } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The filter surface every register shares: the controls themselves, a chip per
 * active constraint, and one "clear all".
 *
 * On a phone the controls move into a drawer behind a button that carries the
 * active count — a five-control grid above a table pushed the first row of data
 * off the screen. The chips stay outside the drawer, so what is filtering the
 * list is visible without opening anything.
 */
export function FilterBar({
  defs,
  state,
  search,
  onSearchChange,
  className,
}: {
  defs: FilterDef[];
  state: FilterState;
  /**
   * The free-text term. Held by `useTableQuery`, never persisted: it is
   * routinely a client name or an account number.
   */
  search?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
}) {
  const t = useTranslations("filters");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  const searchable = onSearchChange !== undefined;
  const anyActive = state.activeCount > 0 || (search ?? "") !== "";

  const controls = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {defs.map((def) => (
        <FilterControl key={def.key} def={def} state={state} />
      ))}
    </div>
  );

  return (
    <div className={cn("space-y-3 border-b border-border p-3", className)}>
      <div className="flex flex-wrap items-end gap-3">
        {searchable ? (
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <TextInput
              label={tc("search")}
              type="search"
              placeholder={tc("searchPlaceholder")}
              value={search ?? ""}
              onChange={(event) => onSearchChange?.(event.target.value)}
            />
          </div>
        ) : null}

        {defs.length > 0 ? (
          <Button
            variant="secondary"
            className="sm:hidden"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {state.activeCount > 0
              ? t("showWithCount", { count: state.activeCount })
              : t("show")}
          </Button>
        ) : null}
      </div>

      {defs.length > 0 ? (
        <div className="hidden sm:block">{controls}</div>
      ) : null}

      {anyActive ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* Announced as a group so the count of applied filters is reachable
              without hunting through the chips one by one. */}
          <span className="sr-only" role="status">
            {t("activeCount", { count: state.activeCount })}
          </span>
          {defs.map((def) => (
            <FilterChip key={def.key} def={def} state={state} />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              state.clearAll();
              onSearchChange?.("");
            }}
          >
            {t("clearAll")}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        variant="sheet"
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => state.clearAll()}>
              {t("clearAll")}
            </Button>
            <Button onClick={() => setOpen(false)}>{t("done")}</Button>
          </div>
        }
      >
        {controls}
      </Dialog>
    </div>
  );
}

function FilterControl({
  def,
  state,
}: {
  def: FilterDef;
  state: FilterState;
}) {
  const t = useTranslations("filters");
  const tc = useTranslations("common");

  if (def.type === "select") {
    return (
      <SelectInput
        label={def.label}
        value={state.get(def.key)}
        onChange={(event) => state.set(def.key, event.target.value)}
      >
        <option value="">{tc("all")}</option>
        {def.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>
    );
  }

  if (def.type === "text") {
    return (
      <TextInput
        label={def.label}
        placeholder={def.placeholder}
        value={state.get(def.key)}
        onChange={(event) => state.set(def.key, event.target.value)}
      />
    );
  }

  const [fromKey, toKey] = filterKeys(def);
  const date = def.type === "dateRange";

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-fg-muted">
        {def.label}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <TextInput
          label={date ? t("from") : t("minAmount")}
          type={date ? "date" : "number"}
          numeric
          value={state.get(fromKey)}
          onChange={(event) => state.set(fromKey, event.target.value)}
        />
        <TextInput
          label={date ? t("to") : t("maxAmount")}
          type={date ? "date" : "number"}
          numeric
          value={state.get(toKey)}
          onChange={(event) => state.set(toKey, event.target.value)}
        />
      </div>
    </fieldset>
  );
}

/** The human-readable value of one active filter, or null when it is unset. */
function chipValue(
  def: FilterDef,
  state: FilterState,
  t: (key: string, values?: Record<string, string>) => string,
): string | null {
  if (def.type === "select") {
    const value = state.get(def.key);
    if (!value) return null;
    return def.options.find((option) => option.value === value)?.label ?? value;
  }

  if (def.type === "text") {
    return state.get(def.key) || null;
  }

  const [fromKey, toKey] = filterKeys(def);
  const raw = { from: state.get(fromKey), to: state.get(toKey) };
  if (!raw.from && !raw.to) return null;

  const show = (value: string) =>
    def.type === "dateRange" ? formatDate(value) : value;

  if (raw.from && raw.to) {
    return t("rangeBetween", { from: show(raw.from), to: show(raw.to) });
  }
  return raw.from
    ? t("rangeFrom", { value: show(raw.from) })
    : t("rangeTo", { value: show(raw.to) });
}

function FilterChip({ def, state }: { def: FilterDef; state: FilterState }) {
  const t = useTranslations("filters");
  const value = chipValue(def, state, t);
  if (!value) return null;

  const name = `${def.label}: ${value}`;
  return (
    <button
      type="button"
      onClick={() => state.clear(def)}
      aria-label={t("remove", { name })}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border",
        "bg-surface-muted px-2.5 py-1 text-xs text-fg transition-colors hover:bg-surface",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      <span className="truncate">
        <span className="text-fg-muted">{def.label}:</span>{" "}
        {/* A filter value is user input or a code — isolated from the label. */}
        <bdi>{value}</bdi>
      </span>
      <X className="size-3 shrink-0" aria-hidden />
    </button>
  );
}

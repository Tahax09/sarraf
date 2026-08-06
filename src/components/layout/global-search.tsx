"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { Clock, CornerDownLeft, Loader2, Search, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Dialog } from "@/components/ui/dialog";
import { highlight } from "@/lib/search/fuzzy";
import { useSearch } from "@/components/providers/search-provider";
import { MIN_QUERY_LENGTH, type SearchResult } from "@/lib/search/types";
import { useChordLabel, useShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/**
 * Command palette.
 *
 * The header used to submit its search box to the ledger with the term in the
 * query string; a term here is routinely a client name or an account number, so
 * that put personal data into history, referrers and any proxy log along the
 * way. The palette keeps the term in memory, sends it as a request parameter,
 * and navigates to a record instead.
 *
 * Everything it renders comes from `useSearch()` — swapping the service for a
 * real `/search` endpoint changes nothing in this file.
 */
export function GlobalSearch() {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const router = useRouter();
  const chord = useChordLabel();
  const {
    open,
    setOpen,
    query,
    setQuery,
    groups,
    flat,
    loading,
    failed,
    activeIndex,
    setActiveIndex,
    moveActive,
    recent,
    remember,
    clearRecent,
  } = useSearch();

  const baseId = useId();
  const listId = `${baseId}-list`;
  const labelId = `${baseId}-label`;
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useShortcut(
    {
      id: "search.open",
      keys: "mod+k",
      descriptionKey: "openSearch",
      group: "global",
      // Reachable from inside a form field: that is where an operator already is
      // when they realise they need to look something up.
      whileTyping: true,
    },
    () => setOpen(true),
  );

  useShortcut(
    {
      id: "search.focus",
      keys: "/",
      descriptionKey: "focusSearch",
      group: "global",
    },
    () => setOpen(true),
  );

  // The native <dialog> moves focus to the first tabbable child, which is close
  // enough — but the input must be it, and it must be selected on reopen.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Keep the highlighted row inside the scroll box when arrow keys walk past it.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, flat.length]);

  function go(result: SearchResult) {
    remember(query);
    setOpen(false);
    router.push(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      const result = flat[activeIndex];
      if (result) {
        event.preventDefault();
        go(result);
      }
    }
  }

  const term = query.trim();
  const tooShort = term.length < MIN_QUERY_LENGTH;
  const showRecent = tooShort && recent.length > 0;
  const activeId = flat[activeIndex]
    ? `${baseId}-option-${flat[activeIndex].id}`
    : undefined;

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      labelledBy={labelId}
      className="sm:max-w-2xl"
    >
      <div className="-mx-4 -my-4">
        <h2 id={labelId} className="sr-only">
          {t("title")}
        </h2>

        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label={t("title")}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("placeholder")}
            className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          {loading ? (
            <Loader2
              className="size-4 shrink-0 animate-spin text-fg-subtle"
              aria-hidden
            />
          ) : null}
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label={tc("clearFilters")}
              className="rounded-md p-1 text-fg-subtle hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="max-h-[60dvh] overflow-y-auto">
          {/* One polite region for the whole result state: a screen reader hears
              "12 results" once, not a stream of half-typed counts. */}
          <p aria-live="polite" className="sr-only">
            {loading
              ? tc("loading")
              : tooShort
                ? ""
                : t("resultCount", { count: flat.length })}
          </p>

          {showRecent ? (
            <section aria-labelledby={`${baseId}-recent`} className="py-2">
              <div className="flex items-center justify-between px-4 py-1">
                <h3
                  id={`${baseId}-recent`}
                  className="text-xs font-medium text-fg-muted"
                >
                  {t("recent")}
                </h3>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="rounded-md px-1.5 py-0.5 text-xs text-fg-subtle hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {t("clearRecent")}
                </button>
              </div>
              <ul>
                {recent.map((entry) => (
                  <li key={entry}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(entry);
                        inputRef.current?.focus();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-start text-sm text-fg hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                    >
                      <Clock className="size-4 text-fg-subtle" aria-hidden />
                      <span className="truncate">{entry}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {failed ? (
            <p className="px-4 py-8 text-center text-sm text-danger">
              {t("failed")}
            </p>
          ) : null}

          {!failed && !tooShort && !loading && flat.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-fg">{t("noResults")}</p>
              <p className="mt-1 text-xs text-fg-muted">{t("noResultsHint")}</p>
            </div>
          ) : null}

          {tooShort && !showRecent ? (
            <p className="px-4 py-10 text-center text-sm text-fg-muted">
              {t("hint", { min: MIN_QUERY_LENGTH })}
            </p>
          ) : null}

          <div id={listId} role="listbox" aria-label={t("title")}>
            {groups.map((group) => (
              <section
                key={group.category}
                role="group"
                aria-labelledby={`${baseId}-${group.category}`}
                className="py-1"
              >
                <h3
                  id={`${baseId}-${group.category}`}
                  className="px-4 py-1 text-xs font-medium text-fg-muted"
                >
                  {t(`categories.${group.category}`)}
                </h3>
                {group.results.map((result) => {
                  const index = flat.indexOf(result);
                  const active = index === activeIndex;
                  const Icon = result.icon;
                  return (
                    <a
                      key={result.id}
                      ref={active ? activeRef : undefined}
                      id={`${baseId}-option-${result.id}`}
                      role="option"
                      aria-selected={active}
                      href={result.href}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={(event) => {
                        // Let modified clicks open a new tab as they should.
                        if (event.metaKey || event.ctrlKey) return;
                        event.preventDefault();
                        go(result);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 text-sm",
                        active ? "bg-accent-soft" : "hover:bg-surface-muted",
                      )}
                    >
                      {Icon ? (
                        <Icon
                          className="size-4 shrink-0 text-fg-subtle"
                          aria-hidden
                        />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <bdi className="block truncate text-fg">
                          {highlight(result.title, result.matches).map(
                            (segment, position) =>
                              segment.match ? (
                                <mark
                                  key={position}
                                  className="bg-transparent font-semibold text-accent"
                                >
                                  {segment.text}
                                </mark>
                              ) : (
                                <span key={position}>{segment.text}</span>
                              ),
                          )}
                        </bdi>
                        {result.subtitle ? (
                          <bdi className="block truncate text-xs text-fg-muted">
                            {result.subtitle}
                          </bdi>
                        ) : null}
                      </span>
                      {result.meta ? (
                        <span className="numeric shrink-0 text-xs text-fg-muted">
                          {result.meta}
                        </span>
                      ) : null}
                      {active ? (
                        <CornerDownLeft
                          className="size-3.5 shrink-0 text-fg-subtle"
                          aria-hidden
                        />
                      ) : null}
                    </a>
                  );
                })}
              </section>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-fg-muted">
          <span>{t("navigateHint")}</span>
          <span className="numeric">{chord("Escape")}</span>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * The header affordance. A button, not an input: the palette owns the field, so
 * a second one here would be a focus trap of its own making.
 */
export function GlobalSearchTrigger({ className }: { className?: string }) {
  const t = useTranslations("search");
  const { setOpen } = useSearch();
  const chord = useChordLabel();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-fg-subtle",
        "hover:border-accent/40 hover:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-start">
        {t("placeholder")}
      </span>
      <kbd className="hidden shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-fg-muted sm:inline">
        {chord("mod+k")}
      </kbd>
    </button>
  );
}

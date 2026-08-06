"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  count?: number;
};

/**
 * Roving-tabindex tablist. Arrow keys are swapped under RTL so "next" always
 * means the visually next tab.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  /*
   * Keep the selected tab on screen.
   *
   * The strip scrolls sideways once there are more tabs than fit, which on a
   * phone is most of them, and the selected one is regularly outside the
   * visible run — restored from a previous visit, or reached with the arrow
   * keys. A reader then sees a panel of rows with nothing marked as selected.
   * `nearest` only scrolls when it has to, so a tab already in view stays put
   * and the strip does not jump on every render.
   */
  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  function move(delta: number) {
    const index = items.findIndex((i) => i.value === value);
    const next = (index + delta + items.length) % items.length;
    onChange(items[next].value);
    const buttons = listRef.current?.querySelectorAll("button");
    buttons?.[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border",
        className,
      )}
      onKeyDown={(event) => {
        const rtl = document.documentElement.dir === "rtl";
        if (event.key === "ArrowRight") {
          event.preventDefault();
          move(rtl ? -1 : 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(rtl ? 1 : -1);
        }
      }}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            /*
             * Only the selected tab points at a panel, because only the
             * selected panel is mounted. An `aria-controls` naming an id that
             * is not in the document is not a harmless hint — it is an invalid
             * attribute value, and a reader that follows it lands nowhere. The
             * pattern permits omitting it; it does not permit a dangling one.
             */
            aria-controls={selected ? `tabpanel-${item.value}` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              selected
                ? "border-accent text-accent"
                : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "numeric rounded-full px-1.5 py-0.5 text-xs",
                  selected
                    ? "bg-accent-soft text-accent"
                    : "bg-surface-muted text-fg-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

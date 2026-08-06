"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Segment<T extends string> = {
  value: T;
  label: ReactNode;
  /** Rendered before the label — a flag, a language glyph, a field icon. */
  icon?: ReactNode;
};

/**
 * A small set of mutually exclusive choices, all of them on screen.
 *
 * A radiogroup rather than a tablist: nothing here controls a panel of content
 * elsewhere on the page, it picks one of a few values. That distinction is what
 * a screen reader announces, so it is worth getting right — "radio, 2 of 2,
 * selected" tells the reader what the control is; "tab" would not.
 *
 * Used where the options are few and the reader benefits from seeing all of
 * them: the language choice on the sign-in page, where a menu labelled in a
 * language you cannot read is no help, and the sign-in method, where the point
 * is knowing the other way in exists.
 *
 * Keyboard behaviour is the radiogroup pattern, not the button-list one: the
 * group is a single tab stop landing on the selected option, and the arrows
 * move between options and select as they go. Left and right follow the
 * reading direction — in Arabic, `ArrowLeft` advances — because the arrow that
 * points at the next option is the one the operator will press.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
  disabled,
  className,
  leading,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  /** Fixed content at the reading-start edge, inside the frame. */
  leading?: ReactNode;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  function move(from: number, delta: number) {
    // Wraps, as the pattern requires: the last option's "next" is the first.
    const next = (from + delta + segments.length) % segments.length;
    const target = segments[next];
    if (!target) return;
    onChange(target.value);
    // Selection follows focus here — the options are cheap to switch between
    // and nothing is submitted by choosing one — so focus has to follow too,
    // or the reader is left announcing an option that is no longer current.
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    // The nearest declared direction, not the computed one: direction is set by
    // the `dir` attribute the locale layout puts on `<html>`, and reading the
    // attribute gives the same answer in a browser and under jsdom, where
    // computed style does not inherit through it.
    const declared =
      event.currentTarget.closest("[dir]")?.getAttribute("dir") ??
      document.documentElement.dir;
    const forward = declared === "rtl" ? -1 : 1;
    const step: Record<string, number> = {
      ArrowRight: forward,
      ArrowLeft: -forward,
      ArrowDown: 1,
      ArrowUp: -1,
    };
    if (event.key in step) {
      event.preventDefault();
      move(index, step[event.key]!);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      move(event.key === "Home" ? -1 : 0, event.key === "Home" ? 1 : -1);
    }
  }

  // A radiogroup with nothing selected still needs a way in, so the first
  // option holds the tab stop until one is.
  const selectedIndex = segments.findIndex((segment) => segment.value === value);
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-surface p-1",
        className,
      )}
    >
      {leading}
      {segments.map((segment, index) => {
        const selected = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={index === tabStop ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onChange(segment.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              selected
                ? "bg-accent-soft font-medium text-accent"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {segment.icon}
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

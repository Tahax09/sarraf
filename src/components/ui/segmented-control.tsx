"use client";

import type { ReactNode } from "react";
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
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-surface p-1",
        className,
      )}
    >
      {leading}
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
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

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * Built on the native <dialog> element: modal semantics, focus trapping,
 * Escape handling and inertness come from the platform rather than a
 * hand-rolled trap that tends to drift out of sync with the DOM.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  /** `sheet` docks to the inline-end edge (side panel), full-screen on mobile. */
  variant = "center",
  className,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "sheet";
  className?: string;
  labelledBy?: string;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    node.addEventListener("cancel", handleCancel);
    return () => node.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "bg-surface text-fg backdrop:bg-[var(--color-overlay)]",
        "border border-border p-0 shadow-[var(--shadow-pop)]",
        variant === "center"
          ? "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-card"
          : // Full-screen sheet on mobile, inline-end side panel from `sm` up.
            "m-0 h-dvh max-h-dvh w-full max-w-none ms-auto rounded-none sm:w-[32rem] sm:max-w-[92vw]",
        className,
      )}
    >
      {open ? (
        <div className="flex h-full max-h-[85dvh] flex-col sm:max-h-[inherit]">
          {title ? (
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{title}</h2>
                {description ? (
                  <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="rounded-md p-1 text-fg-muted hover:bg-surface-muted hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

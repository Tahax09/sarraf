"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
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
  /**
   * `sheet` docks to the inline-end edge (side panel), full-screen on mobile.
   * `drawer` docks to the inline-start edge and stays narrow — navigation.
   */
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
  variant?: "center" | "sheet" | "drawer";
  className?: string;
  labelledBy?: string;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const autoId = useId();

  // A dialog with no accessible name is announced as an unlabelled group. The
  // heading is the name unless the caller points somewhere better.
  const titleId = title ? `${autoId}-title` : undefined;
  const descriptionId = description ? `${autoId}-description` : undefined;
  const labelId = labelledBy ?? titleId;

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
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "bg-surface text-fg backdrop:bg-[var(--color-overlay)]",
        "border border-border p-0 shadow-[var(--shadow-pop)]",
        variant === "center" &&
          "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-card",
        // Full-screen sheet on mobile, inline-end side panel from `sm` up.
        variant === "sheet" &&
          "m-0 h-dvh max-h-dvh w-full max-w-none ms-auto rounded-none sm:w-[32rem] sm:max-w-[92vw]",
        // Navigation drawer: inline-start, and never the full width — the page
        // behind it stays visible, which is what tells you it is temporary.
        variant === "drawer" &&
          "m-0 h-dvh max-h-dvh w-72 max-w-[85vw] me-auto rounded-none",
        className,
      )}
    >
      {open ? (
        <div
          className={cn(
            "flex h-full flex-col",
            // A centred dialog grows with its content but never past the fold;
            // the edge-docked variants already fill the viewport height.
            variant === "center" && "max-h-[85dvh]",
            variant === "sheet" && "max-h-[85dvh] sm:max-h-[inherit]",
          )}
        >
          {title ? (
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold">
                  {title}
                </h2>
                {description ? (
                  <p
                    id={descriptionId}
                    className="mt-0.5 text-xs text-fg-muted"
                  >
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="rounded-md p-1 text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

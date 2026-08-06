"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Rows2, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createRecordStore } from "@/lib/local-store";

export type Density = "comfortable" | "compact";

/**
 * Row height, shared across every register in the session.
 *
 * A display preference, not data: an operator scanning the ledger for one
 * reference wants as many rows on screen as fit, while one reading the day's
 * approvals wants room between them. Stored so the choice survives moving
 * between registers, and session-scoped like every other view preference here.
 */
const densityStore = createRecordStore("saraf.table");

export function useDensity(): [Density, (next: Density) => void] {
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

/** Labelled for the state it switches to, so the button says what it does. */
export function DensityToggle({
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

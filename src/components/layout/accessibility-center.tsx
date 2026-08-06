"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Accessibility } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useA11yPreferences } from "@/components/providers/a11y-provider";
import {
  contrastSettings,
  motionSettings,
  textSizeSettings,
  type A11yPreferences,
} from "@/lib/a11y-preferences";
import { useOptionalShortcutRegistry } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/**
 * Accessibility Center.
 *
 * WCAG asks that motion, contrast and text size be adjustable without leaving
 * the product or reaching for OS settings the operator may not control on a
 * shared branch machine. Each choice is a radio group, not a toggle, because
 * "follow my system" is a real third answer for motion and hiding it behind an
 * on/off switch would silently override the OS.
 */
function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  label,
}: {
  legend: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: (option: T) => string;
}) {
  const name = useId();

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-1.5 text-sm",
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
                selected
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {label(option)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The button that opens the centre: beside the bell in the app header, and in
 * the toolbar on the signed-out pages. An operator who needs larger text needs
 * it to read the sign-in form, not after they are past it.
 */
export function AccessibilityTrigger({ className }: { className?: string }) {
  const t = useTranslations("a11y");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("title")}
        className={cn(
          "rounded-lg p-2 text-fg-muted hover:bg-surface-muted hover:text-fg",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          className,
        )}
      >
        <Accessibility className="size-5" aria-hidden />
      </button>
      <AccessibilityCenter open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AccessibilityCenter({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("a11y");
  const tc = useTranslations("common");
  const { preferences, update, reset } = useA11yPreferences();
  // Signed-out pages open this dialog too, and they register no shortcuts.
  // Offering a sheet that would list nothing is worse than not offering it.
  const shortcuts = useOptionalShortcutRegistry();

  const setting = <K extends keyof A11yPreferences>(
    key: K,
    next: A11yPreferences[K],
  ) => update({ [key]: next } as Partial<A11yPreferences>);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("title")}
      description={t("description")}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={reset}>
            {tc("reset")}
          </Button>
          <Button size="sm" onClick={onClose}>
            {tc("close")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <OptionGroup
          legend={t("textSize")}
          options={textSizeSettings}
          value={preferences.textSize}
          onChange={(next) => setting("textSize", next)}
          label={(option) => t(`textSizes.${option}`)}
        />
        <OptionGroup
          legend={t("contrast")}
          options={contrastSettings}
          value={preferences.contrast}
          onChange={(next) => setting("contrast", next)}
          label={(option) => t(`contrasts.${option}`)}
        />
        <OptionGroup
          legend={t("motion")}
          options={motionSettings}
          value={preferences.motion}
          onChange={(next) => setting("motion", next)}
          label={(option) => t(`motions.${option}`)}
        />

        {shortcuts ? (
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-fg">{t("keyboardTitle")}</p>
            <p className="mt-1 text-xs text-fg-muted">{t("keyboardBody")}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                onClose();
                shortcuts.setHelpOpen(true);
              }}
            >
              {t("keyboardAction")}
            </Button>
          </div>
        ) : null}

        <p className="text-xs text-fg-subtle">{t("persistenceNote")}</p>
      </div>
    </Dialog>
  );
}

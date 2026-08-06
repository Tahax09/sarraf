"use client";

import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Light/dark, as a standalone control.
 *
 * The user menu keeps its own version of this switch rather than importing
 * this one: inside a menu the row has to be a `menuitemcheckbox` with a text
 * label, and here it is an icon button that says what it will do. Same
 * preference, two presentations, and collapsing them would mean a component
 * that renders as either — more code than the twelve lines it would save.
 *
 * The label names the destination ("switch to dark mode"), not the current
 * state, because a button's name should say what pressing it does.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? t("themeLight") : t("themeDark")}
      className={cn(
        "rounded-lg p-2 text-fg-muted hover:bg-surface-muted hover:text-fg",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      {dark ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </button>
  );
}

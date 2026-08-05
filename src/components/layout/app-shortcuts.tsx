"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import {
  useChordLabel,
  useShortcut,
  useShortcutRegistry,
  type Shortcut,
  type ShortcutGroup,
} from "@/lib/shortcuts";

const GROUP_ORDER: ShortcutGroup[] = ["global", "navigation", "forms"];

/**
 * The shortcuts that belong to the application shell rather than to any one
 * screen, plus the help dialog that documents whatever is registered.
 *
 * Escape and Ctrl/Cmd+S are declared `disabled` here: Escape is handled by the
 * native <dialog> element and Ctrl/Cmd+S by whichever form is on screen, so the
 * registry must describe them without also intercepting them. Declaring them
 * keeps the help dialog honest — it lists every chord that does something, not
 * only the ones this file happens to own.
 */
export function AppShortcuts() {
  const t = useTranslations("shortcuts");
  const chord = useChordLabel();
  const { shortcuts, helpOpen, setHelpOpen } = useShortcutRegistry();

  useShortcut(
    {
      id: "help.toggle",
      keys: "?",
      descriptionKey: "showHelp",
      group: "global",
    },
    () => setHelpOpen(true),
  );

  useShortcut(
    {
      id: "nav.back",
      keys: "alt+ArrowLeft",
      descriptionKey: "goBack",
      group: "navigation",
      whileTyping: true,
    },
    () => window.history.back(),
  );

  useShortcut(
    {
      id: "nav.forward",
      keys: "alt+ArrowRight",
      descriptionKey: "goForward",
      group: "navigation",
      whileTyping: true,
    },
    () => window.history.forward(),
  );

  useShortcut(
    {
      id: "dialog.close",
      keys: "Escape",
      descriptionKey: "closeDialog",
      group: "global",
      disabled: true,
    },
    () => {},
  );

  useShortcut(
    {
      id: "form.save.doc",
      keys: "mod+s",
      descriptionKey: "save",
      group: "forms",
      disabled: true,
    },
    () => {},
  );

  // A live handler registered by the form on screen wins over the placeholder,
  // so each chord appears exactly once.
  const listed = new Map<string, Shortcut>();
  for (const shortcut of shortcuts) {
    const existing = listed.get(shortcut.keys);
    if (!existing || (existing.disabled && !shortcut.disabled)) {
      listed.set(shortcut.keys, shortcut);
    }
  }

  return (
    <Dialog
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      title={t("title")}
      description={t("description")}
    >
      <div className="space-y-5">
        {GROUP_ORDER.map((group) => {
          const rows = [...listed.values()].filter(
            (shortcut) => shortcut.group === group,
          );
          if (rows.length === 0) return null;

          return (
            <section key={group}>
              <h3 className="mb-2 text-xs font-medium text-fg-muted">
                {t(`groups.${group}`)}
              </h3>
              <dl className="divide-y divide-border rounded-lg border border-border">
                {rows.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between gap-4 px-3 py-2"
                  >
                    <dt className="text-sm text-fg">
                      {t(shortcut.descriptionKey)}
                    </dt>
                    <dd>
                      <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-fg-muted">
                        {chord(shortcut.keys)}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}

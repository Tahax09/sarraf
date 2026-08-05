"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Banknote,
  ChevronDown,
  Coins,
  Repeat,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { usePermission } from "@/lib/use-permission";
import { useChordLabel, useShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import type { PermissionModule } from "@/lib/permissions";

/** The create flows an operator reaches for most, gated by the same permission
 *  the destination route enforces — a quick action that lands on a 403 is worse
 *  than no quick action.
 *
 *  Each one carries a chord, bound to the action rather than to its position in
 *  the list: an operator without the deposit permission still reaches a
 *  withdrawal with Alt+2, instead of the keys shifting under them. */
const QUICK_ACTIONS = [
  {
    module: "deposits",
    href: "/core/deposit/register",
    labelKey: "quickDeposit",
    icon: Wallet,
    keys: "alt+1",
  },
  {
    module: "withdrawal",
    href: "/core/withdrawal/register",
    labelKey: "quickWithdrawal",
    icon: Banknote,
    keys: "alt+2",
  },
  {
    module: "fundTransfer",
    href: "/core/fund-transfer/register",
    labelKey: "quickFundTransfer",
    icon: Repeat,
    keys: "alt+3",
  },
  {
    module: "ceft",
    href: "/core/currency-exchange-transfer/register",
    labelKey: "quickExchange",
    icon: Coins,
    keys: "alt+4",
  },
] as const satisfies readonly {
  module: PermissionModule;
  href: string;
  labelKey: string;
  icon: LucideIcon;
  keys: string;
}[];

type QuickAction = (typeof QUICK_ACTIONS)[number];

function useAllowedActions(): QuickAction[] {
  const permission = usePermission();
  return QUICK_ACTIONS.filter((action) =>
    permission.can(action.module, "create"),
  );
}

/**
 * Binds one action to its chord. Rendered from the rail, which is mounted on
 * every viewport — small screens hide it rather than drop it — so each chord is
 * registered once and the help dialog lists it once.
 *
 * An action the operator lacks the permission for is registered `disabled`:
 * described in the help dialog, inert on the page.
 */
function QuickActionShortcut({
  action,
  disabled,
}: {
  action: QuickAction;
  disabled: boolean;
}) {
  const router = useRouter();
  useShortcut(
    {
      id: `quick.${action.labelKey}`,
      keys: action.keys,
      descriptionKey: action.labelKey,
      group: "navigation",
      disabled,
    },
    () => router.push(action.href),
  );
  return null;
}

function ActionLink({
  action,
  hint,
  className,
}: {
  action: QuickAction;
  /** Chord to show beside the label. Omitted where a keyboard is unlikely. */
  hint?: string;
  className?: string;
}) {
  const t = useTranslations("dashboard");
  return (
    <Link
      href={action.href}
      className={cn(
        "flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-2.5",
        "text-sm font-medium text-fg transition-colors hover:border-accent hover:text-accent",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <action.icon className="size-4 shrink-0 text-fg-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{t(action.labelKey)}</span>
      {hint ? (
        <kbd className="numeric shrink-0 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
          {hint}
        </kbd>
      ) : null}
    </Link>
  );
}

/**
 * The third column of the dashboard: the create flows, always in the same place
 * on a desktop screen so they can be reached without reading the page first.
 *
 * Hidden rather than unmounted below `xl`, where the collapsible panel takes
 * over — that keeps one set of shortcut registrations for the whole page.
 */
export function QuickActionsRail({ className }: { className?: string }) {
  const t = useTranslations("dashboard");
  const chord = useChordLabel();
  const actions = useAllowedActions();

  const shortcuts = QUICK_ACTIONS.map((action) => (
    <QuickActionShortcut
      key={action.href}
      action={action}
      disabled={!actions.includes(action)}
    />
  ));

  // Nothing to offer — a read-only auditor gets no empty rail taking up space.
  if (actions.length === 0) return <>{shortcuts}</>;

  return (
    <nav
      aria-label={t("quickActions")}
      className={cn("hidden xl:block", className)}
    >
      {shortcuts}
      <div className="sticky top-4 space-y-2 rounded-card border border-border bg-surface-muted p-3">
        <p className="flex items-center gap-2 px-1 text-xs font-medium text-fg-muted">
          <Zap className="size-3.5 shrink-0" aria-hidden />
          {t("quickActions")}
        </p>
        {actions.map((action) => (
          <ActionLink
            key={action.href}
            action={action}
            hint={chord(action.keys)}
          />
        ))}
      </div>
    </nav>
  );
}

/**
 * The same actions below `xl`, where a permanent column would eat the width the
 * figures need. Collapsed by default on a phone, where the fold is close and
 * the operator scrolled here to read something specific.
 */
export function QuickActionsPanel() {
  const t = useTranslations("dashboard");
  const actions = useAllowedActions();
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  return (
    <nav aria-label={t("quickActions")} className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-card border border-border bg-surface px-3 py-2.5",
          "text-sm font-medium text-fg transition-colors hover:border-accent",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        <Zap className="size-4 shrink-0 text-fg-muted" aria-hidden />
        <span className="flex-1 text-start">{t("quickActions")}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-fg-subtle transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {actions.map((action) => (
            <ActionLink key={action.href} action={action} />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

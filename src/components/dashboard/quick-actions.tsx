"use client";

import { useTranslations } from "next-intl";
import {
  Banknote,
  Coins,
  Repeat,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePermission } from "@/lib/use-permission";
import type { PermissionModule } from "@/lib/permissions";

/** The create flows an operator reaches for most, gated by the same permission
 *  the destination route enforces — a quick action that lands on a 403 is worse
 *  than no quick action. */
const QUICK_ACTIONS = [
  {
    module: "deposits",
    href: "/core/deposit/register",
    labelKey: "quickDeposit",
    icon: Wallet,
  },
  {
    module: "withdrawal",
    href: "/core/withdrawal/register",
    labelKey: "quickWithdrawal",
    icon: Banknote,
  },
  {
    module: "fundTransfer",
    href: "/core/fund-transfer/register",
    labelKey: "quickFundTransfer",
    icon: Repeat,
  },
  {
    module: "ceft",
    href: "/core/currency-exchange-transfer/register",
    labelKey: "quickExchange",
    icon: Coins,
  },
] as const satisfies readonly {
  module: PermissionModule;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}[];

export function QuickActions() {
  const t = useTranslations("dashboard");
  const permission = usePermission();
  const actions = QUICK_ACTIONS.filter((action) =>
    permission.can(action.module, "create"),
  );

  // Nothing to offer — a read-only auditor gets no empty card taking up space.
  if (actions.length === 0) return null;

  return (
    <nav aria-label={t("quickActions")} className="grid gap-2 sm:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-2.5 text-sm font-medium text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <action.icon className="size-4 shrink-0 text-fg-muted" aria-hidden />
          <span className="truncate">{t(action.labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}

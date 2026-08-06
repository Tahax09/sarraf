import {
  ArrowLeftRight,
  Banknote,
  Building2,
  ChartPie,
  ClipboardList,
  Coins,
  CreditCard,
  FileText,
  Globe2,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  Repeat,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PermissionModule } from "@/lib/permissions";

export type NavItem = {
  /** Key into the `nav` message namespace. */
  labelKey: string;
  href: string;
  icon?: LucideIcon;
  module?: PermissionModule;
  badge?: "pendingAuthorized" | "pendingExternal";
};

export type NavGroup = {
  labelKey: string;
  icon: LucideIcon;
  /** Group landing route, when the group itself is clickable. */
  href?: string;
  items: NavItem[];
  /** Phase 2 sections render placeholders but keep their place in the IA. */
  phase2?: boolean;
};

export const navGroups: NavGroup[] = [
  {
    labelKey: "dashboard",
    icon: LayoutDashboard,
    items: [
      { labelKey: "overview", href: "/dashboard", module: "dashboard" },
      {
        labelKey: "topClients",
        href: "/core/top-clients",
        module: "dashboard",
      },
    ],
  },
  {
    labelKey: "accountManagement",
    icon: Users,
    items: [
      { labelKey: "clients", href: "/core/clients/list", module: "clients" },
      { labelKey: "accounts", href: "/core/accounts", module: "accounts" },
    ],
  },
  {
    labelKey: "moneyMovement",
    icon: ArrowLeftRight,
    items: [
      {
        labelKey: "withdrawal",
        href: "/core/withdrawal/list",
        icon: Banknote,
        module: "withdrawal",
      },
      {
        labelKey: "authorizedWithdrawal",
        href: "/core/authorized-withdrawal",
        icon: ShieldCheck,
        module: "authorizedWithdrawal",
        badge: "pendingAuthorized",
      },
      {
        labelKey: "externalTransfer",
        href: "/core/external-transfer",
        icon: Globe2,
        module: "externalTransfer",
        badge: "pendingExternal",
      },
      {
        labelKey: "fundTransfer",
        href: "/core/fund-transfer/list",
        icon: Repeat,
        module: "fundTransfer",
      },
      {
        labelKey: "ceft",
        href: "/core/currency-exchange-transfer/list",
        icon: Coins,
        module: "ceft",
      },
      {
        labelKey: "deposits",
        href: "/core/deposit/list",
        icon: Wallet,
        module: "deposits",
      },
    ],
  },
  {
    labelKey: "centralBank",
    icon: Landmark,
    phase2: true,
    items: [
      {
        labelKey: "cblConnection",
        href: "/cbl/connection",
        module: "centralBank",
      },
      {
        labelKey: "cblPurchaseRequests",
        href: "/cbl/purchase-requests",
        module: "centralBank",
      },
      {
        labelKey: "cblContracts",
        href: "/cbl/contracts",
        module: "centralBank",
      },
      {
        labelKey: "cblExchangeRates",
        href: "/cbl/exchange-rates",
        module: "centralBank",
      },
    ],
  },
  {
    labelKey: "bankingServices",
    icon: CreditCard,
    phase2: true,
    items: [
      { labelKey: "bankingServices", href: "/ubs", module: "bankingServices" },
    ],
  },
  {
    labelKey: "reports",
    icon: FileText,
    items: [{ labelKey: "reports", href: "/core/reports", module: "reports" }],
  },
  {
    labelKey: "analytics",
    icon: ChartPie,
    items: [
      {
        labelKey: "branchCashFlow",
        href: "/core/analytics/branch-cash-flow",
        module: "analytics",
      },
      {
        labelKey: "allOperations",
        href: "/core/analytics/all-operations",
        module: "analytics",
      },
      {
        labelKey: "activity",
        href: "/core/analytics/activity",
        module: "analytics",
      },
    ],
  },
  /*
   * The rules the panel applies to money: what an operation costs, which
   * currencies exist, which operations are allowed, and the reference data the
   * forms read from. Changing anything here changes what every branch can do
   * tomorrow, which is why it sits at the far end of the sidebar rather than
   * beside the queues an operator works all day.
   */
  {
    labelKey: "configuration",
    icon: SlidersHorizontal,
    items: [
      {
        labelKey: "operationsPricing",
        href: "/core/system/operations-pricing",
        icon: ListOrdered,
        module: "pricing",
      },
      {
        labelKey: "currencies",
        href: "/core/system/currencies",
        icon: Coins,
        module: "currencies",
      },
      {
        labelKey: "operationRules",
        href: "/core/system/operation-rules",
        icon: ClipboardList,
        module: "operationRules",
      },
      {
        labelKey: "countries",
        href: "/settings/address-management/countries",
        icon: Globe2,
        module: "countries",
      },
      {
        labelKey: "systemInfo",
        href: "/settings/system-info",
        icon: Building2,
        module: "systemInfo",
      },
    ],
  },
  /*
   * Who may act, where they act from, and what they did. One group because they
   * are one job: an administrator adding an operator picks their branch and
   * their role in the same sitting, and reads the log when something needs
   * accounting for.
   */
  {
    labelKey: "administration",
    icon: UserCog,
    items: [
      { labelKey: "users", href: "/core/users", icon: Users, module: "users" },
      {
        labelKey: "roles",
        href: "/core/roles",
        icon: ShieldCheck,
        module: "roles",
      },
      {
        labelKey: "branches",
        href: "/branches",
        icon: Building2,
        module: "branches",
      },
      {
        labelKey: "logs",
        href: "/core/logs",
        icon: ScrollText,
        module: "logs",
      },
    ],
  },
];

/** Bottom-bar destinations on phones — the highest-traffic queues. */
export const mobileQuickNav: NavItem[] = [
  { labelKey: "overview", href: "/dashboard", icon: LayoutDashboard },
  {
    labelKey: "authorizedWithdrawal",
    href: "/core/authorized-withdrawal",
    icon: ShieldCheck,
    badge: "pendingAuthorized",
  },
  {
    labelKey: "externalTransfer",
    href: "/core/external-transfer",
    icon: Globe2,
    badge: "pendingExternal",
  },
  { labelKey: "clients", href: "/core/clients/list", icon: Users },
];

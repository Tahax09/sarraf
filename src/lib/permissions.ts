import type { PermissionAction } from "@/lib/api/types";

/**
 * Permission module keys. These mirror the sidebar groups so the Roles
 * permission matrix and the UI gates stay in lockstep.
 */
export const PERMISSION_MODULES = [
  "dashboard",
  "clients",
  "accounts",
  "withdrawal",
  "authorizedWithdrawal",
  "externalTransfer",
  "fundTransfer",
  "ceft",
  "deposits",
  "centralBank",
  "bankingServices",
  "pricing",
  "currencies",
  "operationRules",
  "users",
  "roles",
  "countries",
  "systemInfo",
  "branches",
  "logs",
  "reports",
  "analytics",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/** Which actions are meaningful per module — drives the matrix editor UI. */
export const MODULE_ACTIONS: Record<PermissionModule, PermissionAction[]> = {
  dashboard: ["view"],
  clients: ["view", "create", "delete"],
  accounts: ["view", "create", "delete"],
  withdrawal: ["view", "create"],
  authorizedWithdrawal: ["view", "create", "approve"],
  externalTransfer: ["view", "create", "approve"],
  fundTransfer: ["view", "create"],
  ceft: ["view", "create"],
  deposits: ["view", "create"],
  centralBank: ["view", "create", "approve"],
  bankingServices: ["view"],
  pricing: ["view", "create"],
  currencies: ["view", "create", "delete"],
  operationRules: ["view", "create"],
  users: ["view", "create", "delete"],
  roles: ["view", "create", "delete"],
  countries: ["view"],
  systemInfo: ["view", "create"],
  branches: ["view", "create", "delete"],
  logs: ["view"],
  reports: ["view"],
  analytics: ["view"],
};

export type PermissionMap = Partial<Record<string, PermissionAction[]>>;

export function can(
  permissions: PermissionMap | undefined,
  module: PermissionModule,
  action: PermissionAction = "view",
): boolean {
  if (!permissions) return false;
  return permissions[module]?.includes(action) ?? false;
}

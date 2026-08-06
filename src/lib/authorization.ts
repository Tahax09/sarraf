import { navGroups } from "@/lib/nav";
import type { PermissionAction } from "@/lib/api/types";
import type { PermissionModule } from "@/lib/permissions";

/**
 * Route-level authorization.
 *
 * The authoritative check is the backend's — it rejects every unauthorized
 * request regardless of what the browser believes. This layer exists so the
 * operator sees an honest "access denied" screen instead of a generic failure,
 * and so actions they cannot perform are never offered. Defence in depth, not a
 * substitute for server enforcement.
 *
 * The table below is derived from `navGroups` rather than written twice, so a
 * new navigation entry is guarded the moment it is added. Only routes that are
 * *not* in the navigation — registration forms, detail routes, the profile —
 * need an explicit entry here.
 */

export type RoutePermission = {
  /** Matched as an exact path or as a `<prefix>/…` ancestor. */
  prefix: string;
  module: PermissionModule;
  action: PermissionAction;
  /** Key in the `nav` message namespace — names the area on the denied screen. */
  labelKey: string;
};

/**
 * Registration routes create records, so `view` on the module is not enough.
 * Listed before the nav-derived entries so the longer, more specific prefix is
 * found first.
 */
const EXPLICIT_ROUTES: RoutePermission[] = [
  {
    // The client register lives at `/core/clients/list`, so a client profile at
    // `/core/clients/<id>` matches no nav entry and would otherwise be reachable
    // by anyone signed in.
    prefix: "/core/clients",
    module: "clients",
    action: "view",
    labelKey: "clients",
  },
  {
    prefix: "/core/withdrawal/register",
    module: "withdrawal",
    action: "create",
    labelKey: "withdrawal",
  },
  {
    prefix: "/core/authorized-withdrawal/register",
    module: "authorizedWithdrawal",
    action: "create",
    labelKey: "authorizedWithdrawal",
  },
  {
    prefix: "/core/external-transfer/register",
    module: "externalTransfer",
    action: "create",
    labelKey: "externalTransfer",
  },
  {
    prefix: "/core/fund-transfer/register",
    module: "fundTransfer",
    action: "create",
    labelKey: "fundTransfer",
  },
  {
    prefix: "/core/currency-exchange-transfer/register",
    module: "ceft",
    action: "create",
    labelKey: "ceft",
  },
  {
    prefix: "/core/deposit/register",
    module: "deposits",
    action: "create",
    labelKey: "deposits",
  },
];

function navRoutes(): RoutePermission[] {
  return navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.module
        ? [
            {
              prefix: item.href,
              module: item.module,
              action: "view" as const,
              labelKey: item.labelKey,
            },
          ]
        : [],
    ),
  );
}

/**
 * Longest prefix wins, so `/core/withdrawal/register` is matched by its own
 * `create` rule rather than by the `/core/withdrawal/list` view rule.
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  ...EXPLICIT_ROUTES,
  ...navRoutes(),
].sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Routes every authenticated user may reach regardless of role: their own
 * profile, and the locale root that only redirects.
 */
const ALWAYS_ALLOWED = ["/profile", "/"];

/**
 * Resolves a locale-stripped pathname to the permission it requires.
 * `null` means the route carries no module requirement — it is reachable by any
 * authenticated user.
 */
export function resolveRoutePermission(
  pathname: string,
): RoutePermission | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (ALWAYS_ALLOWED.includes(path)) return null;
  return (
    ROUTE_PERMISSIONS.find(
      (route) => path === route.prefix || path.startsWith(`${route.prefix}/`),
    ) ?? null
  );
}

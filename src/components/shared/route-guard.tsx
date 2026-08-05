"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { resolveRoutePermission } from "@/lib/authorization";
import { usePermission } from "@/lib/use-permission";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageSkeleton } from "@/components/ui/states";

/**
 * Gates every route inside the app shell on the permission its path requires.
 *
 * Mounted once in the `(app)` layout rather than repeated in 37 pages: the
 * mapping lives in `resolveRoutePermission`, which is derived from the same
 * navigation table the sidebar filters on, so a route cannot be added to the
 * menu and left unguarded.
 *
 * The page's children are not rendered while the decision is pending, which
 * also stops an unauthorized page from firing its queries and collecting a row
 * of 403s in the backend log.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const { ready, failed, can } = usePermission();

  const required = resolveRoutePermission(pathname);

  // No module requirement (profile, redirects) — authentication is enough, and
  // that was already enforced at the edge.
  if (!required) return <>{children}</>;

  // The identity request failing is not the same as being denied. Render the
  // page and let its own queries surface the outage through their error state.
  if (failed) return <>{children}</>;

  if (!ready) return <PageSkeleton />;

  if (!can(required.module, required.action)) {
    return <AccessDenied module={tNav(required.labelKey)} />;
  }

  return <>{children}</>;
}

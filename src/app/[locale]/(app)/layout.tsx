import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RouteGuard } from "@/components/shared/route-guard";

/**
 * Every authenticated route renders inside the shell and inside the guard, so
 * authorization is decided in one place rather than page by page. The shell
 * stays mounted when access is denied, leaving the operator a way out.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <RouteGuard>{children}</RouteGuard>
    </AppShell>
  );
}

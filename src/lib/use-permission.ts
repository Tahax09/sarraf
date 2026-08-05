"use client";

import { useCallback } from "react";
import { useCurrentUser } from "@/lib/api/hooks";
import { can, type PermissionModule } from "@/lib/permissions";
import type { PermissionAction } from "@/lib/api/types";

export type PermissionState = {
  /** False while the session is still loading — nothing is granted yet. */
  ready: boolean;
  /** True when the identity request failed; the caller decides how to degrade. */
  failed: boolean;
  can: (module: PermissionModule, action?: PermissionAction) => boolean;
};

/**
 * Reads the current user's permission map. Backed by the same cached
 * `useCurrentUser` query the shell already issues, so gating a button costs no
 * extra request.
 *
 * While `ready` is false, `can()` returns false: it is safer to briefly hide an
 * action than to flash one the user may not have.
 */
export function usePermission(): PermissionState {
  const { data, isPending, isError } = useCurrentUser();
  const check = useCallback(
    (module: PermissionModule, action: PermissionAction = "view") =>
      can(data?.permissions, module, action),
    [data],
  );
  return { ready: !isPending && !isError, failed: isError, can: check };
}

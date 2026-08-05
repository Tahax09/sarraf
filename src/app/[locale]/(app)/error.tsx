"use client";

import { ErrorPanel } from "@/components/shared/error-panel";

/**
 * The boundary that catches almost everything in practice. It sits inside the
 * `(app)` layout, so the sidebar, header and navigation survive the failure and
 * the operator can move to another screen without a reload.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPanel error={error} retry={retry} boundary="app" />;
}

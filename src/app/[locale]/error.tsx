"use client";

import { ErrorPanel } from "@/components/shared/error-panel";

/**
 * Catches throws from the locale layout's children that escaped a narrower
 * boundary — including from the login route, which has no app shell.
 */
export default function LocaleError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPanel error={error} retry={retry} boundary="locale" fullHeight />;
}

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * App Router stand-in for component tests.
 *
 * `?status=` drives the approval queues, so the mock keeps a real subscribable
 * query string: a `router.replace()` re-renders the subscribers exactly the way
 * Next.js does, instead of silently going nowhere.
 */
let search = "";
let pathname = "/";
const listeners = new Set<() => void>();

export const navigation = {
  /** Every push/replace, newest last — assert redirects against this. */
  calls: [] as string[],
  reset(nextPathname = "/") {
    search = "";
    pathname = nextPathname;
    navigation.calls.length = 0;
    listeners.forEach((listener) => listener());
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function navigate(url: string) {
  navigation.calls.push(url);
  const [nextPath, nextSearch = ""] = url.split("?");
  pathname = nextPath || pathname;
  search = nextSearch;
  listeners.forEach((listener) => listener());
}

function useSearch() {
  return useSyncExternalStore(
    subscribe,
    () => search,
    () => search,
  );
}

function usePath() {
  return useSyncExternalStore(
    subscribe,
    () => pathname,
    () => pathname,
  );
}

const router = {
  push: navigate,
  replace: navigate,
  prefetch: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
};

/** Shape of `next/navigation`. */
export function nextNavigationMock() {
  return {
    useRouter: () => router,
    usePathname: usePath,
    useSearchParams: () => new URLSearchParams(useSearch()),
    useParams: () => ({ locale: "ar" }),
    redirect: navigate,
    notFound: () => {},
  };
}

/** Shape of `@/i18n/navigation` (locale-aware Link/router). */
export function i18nNavigationMock() {
  return {
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children?: ReactNode;
    }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
    useRouter: () => router,
    usePathname: usePath,
    redirect: navigate,
    getPathname: ({ href }: { href: string }) => href,
  };
}

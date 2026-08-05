import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShortcutProvider } from "@/lib/shortcuts";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const messages = { ar, en } as const;

/**
 * Tests run against the real message catalogue, so a missing key or a hardcoded
 * string fails here rather than in QA. Arabic is the default locale, matching
 * production.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function Providers({
  children,
  locale = "ar",
  queryClient,
}: {
  children: ReactNode;
  locale?: "ar" | "en";
  queryClient?: QueryClient;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="Africa/Tripoli"
      now={new Date("2026-01-15T10:00:00Z")}
    >
      <QueryClientProvider client={queryClient ?? makeQueryClient()}>
        {/* Mirrors the app shell: anything rendering a component that claims a
            keyboard chord needs the registry above it. */}
        <ShortcutProvider>{children}</ShortcutProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  {
    locale = "ar",
    queryClient,
    ...options
  }: RenderOptions & { locale?: "ar" | "en"; queryClient?: QueryClient } = {},
) {
  const client = queryClient ?? makeQueryClient();
  return {
    queryClient: client,
    ...render(ui, {
      wrapper: ({ children }) => (
        <Providers locale={locale} queryClient={client}>
          {children}
        </Providers>
      ),
      ...options,
    }),
  };
}

/** Message lookup for assertions, so tests never hardcode UI copy either. */
export function message(
  path: string,
  localeOrValues: "ar" | "en" | Record<string, string> = "ar",
  maybeLocale: "ar" | "en" = "ar",
): string {
  const locale =
    typeof localeOrValues === "string" ? localeOrValues : maybeLocale;
  const values = typeof localeOrValues === "string" ? null : localeOrValues;

  const text = path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown>)?.[key],
      messages[locale],
    ) as string;

  // ICU placeholders only — enough for `{page}`-style keys in assertions.
  return values
    ? text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match)
    : text;
}

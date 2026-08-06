import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { routing, localeDirection, isLocale } from "@/i18n/routing";
import { THEME_COOKIE, defaultTheme, isTheme } from "@/lib/theme";
import {
  A11Y_COOKIE,
  a11yDataAttributes,
  parseA11yPreferences,
} from "@/lib/a11y-preferences";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { A11yProvider } from "@/components/providers/a11y-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { TelemetryProvider } from "@/components/providers/telemetry-provider";
import "../globals.css";

// One family covering Arabic and Latin keeps bilingual pages visually even.
const appFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-app-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Saraf",
  description: "Saraf back-office admin panel",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : defaultTheme;
  // Text size and contrast are rendered into the first response for the same
  // reason the theme is: a reader who needs larger text must not be shown a
  // frame of the default and a reflow.
  const a11y = parseA11yPreferences(cookieStore.get(A11Y_COOKIE)?.value);

  return (
    <html
      lang={locale}
      // Direction follows the locale — the whole layout flips, not just labels.
      dir={localeDirection[locale]}
      data-theme={theme}
      {...a11yDataAttributes(a11y)}
      className={`${appFont.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider initialTheme={theme}>
            <A11yProvider initial={a11y}>
              <QueryProvider>
                {/* Renders nothing. Mounted here so a measurement covers the
                    signed-out pages too — the sign-in screen is the first
                    paint every operator pays for. */}
                <TelemetryProvider />
                {children}
              </QueryProvider>
            </A11yProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

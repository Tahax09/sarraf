import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { routing, localeDirection, isLocale } from "@/i18n/routing";
import { THEME_COOKIE, defaultTheme, isTheme } from "@/lib/theme";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
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

  return (
    <html
      lang={locale}
      // Direction follows the locale — the whole layout flips, not just labels.
      dir={localeDirection[locale]}
      data-theme={theme}
      className={`${appFont.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider initialTheme={theme}>
            <QueryProvider>{children}</QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

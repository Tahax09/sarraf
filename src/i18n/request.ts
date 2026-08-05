import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Money/dates render LTR-formatted regardless of layout direction, so both
    // locales share the same numbering system and calendar.
    formats: {
      dateTime: {
        short: { day: "2-digit", month: "2-digit", year: "numeric" },
        long: {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      },
    },
  };
});

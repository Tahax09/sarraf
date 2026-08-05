/**
 * Shared formatters. Every phone number, amount, date and masked value in the
 * app goes through this module — the source app's inconsistent formatting
 * (`912345678` vs `+218916789012`) came from formatting at each call site.
 *
 * Numbers, money, dates, IBANs and IDs always render LTR (see `.numeric` in
 * globals.css), including inside the Arabic RTL layout.
 */

const DEFAULT_COUNTRY_CODE = "218"; // Libya
const LOCALE_FOR_NUMBERS = "en-US"; // Latin digits in both UI languages.

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 0) return null;

  let national = digits;
  if (national.startsWith("00")) national = national.slice(2);
  if (national.startsWith(DEFAULT_COUNTRY_CODE)) {
    national = national.slice(DEFAULT_COUNTRY_CODE.length);
  }
  national = national.replace(/^0+/, "");
  if (national.length === 0) return null;

  return `${DEFAULT_COUNTRY_CODE}${national}`;
}

/** Canonical display form: `+218 91 234 5678`. */
export function formatPhone(raw: string | null | undefined): string {
  const normalized = normalizePhone(raw);
  if (!normalized) return "—";

  const national = normalized.slice(DEFAULT_COUNTRY_CODE.length);
  if (national.length !== 9) {
    // Unexpected length — still render it consistently rather than raw.
    return `+${DEFAULT_COUNTRY_CODE} ${national}`;
  }
  return `+${DEFAULT_COUNTRY_CODE} ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
}

export function isValidPhone(raw: string | null | undefined): boolean {
  const normalized = normalizePhone(raw);
  return normalized !== null && normalized.length === 12;
}

export function formatNumber(value: number, precision = 3): string {
  return new Intl.NumberFormat(LOCALE_FOR_NUMBERS, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

export function formatAmount(
  value: number,
  currency: string,
  precision = 3,
): string {
  return `${formatNumber(value, precision)} ${currency}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat(LOCALE_FOR_NUMBERS).format(value);
}

/**
 * Signed percentage for a period-on-period change: `0.124` → `+12.4%`. The sign
 * is always written, because "12%" beside a figure reads as a share of it
 * rather than a movement. Whole percentages drop the decimal.
 */
export function formatPercentDelta(ratio: number, precision = 1): string {
  const percent = ratio * 100;
  const rounded = Number(percent.toFixed(precision));
  const body = formatNumber(
    Math.abs(rounded),
    Number.isInteger(rounded) ? 0 : precision,
  );
  // U+2212 MINUS SIGN, not a hyphen: it aligns with the digits at this size.
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${body}%`;
}

export function formatRate(value: number): string {
  return formatNumber(value, 5).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE_FOR_NUMBERS, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE_FOR_NUMBERS, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** `+2h`, `-15m` style deltas for the activity feed and expiry countdowns. */
export function diffToParts(target: string | Date, now: Date = new Date()) {
  const date = typeof target === "string" ? new Date(target) : target;
  const ms = date.getTime() - now.getTime();
  const totalMinutes = Math.floor(Math.abs(ms) / 60000);
  return {
    past: ms < 0,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    totalMinutes,
  };
}

export function formatIban(iban: string): string {
  return iban
    .replace(/\s+/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/**
 * IBAN check per ISO 13616: length/charset, then the mod-97 remainder.
 * Catches transposed digits before the transfer is ever submitted.
 */
export function isValidIban(value: string): boolean {
  const clean = value.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(clean)) return false;

  const rearranged = clean.slice(4) + clean.slice(0, 4);
  // Reduce progressively — the full number overflows Number precision.
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[0-9]/.test(char) ? char : String(char.charCodeAt(0) - 55); // A=10 … Z=35
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/** ISO 3166-1 alpha-2 → regional-indicator flag emoji. */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * Wraps a value in Unicode isolate marks so it keeps its own direction when it
 * is interpolated into a translated string.
 *
 * `${t("availableBalance")}: ${formatAmount(…)}` produces one text run. Inside
 * an Arabic sentence the bidi algorithm resolves the trailing `1,234.560 LYD`
 * against the surrounding RTL paragraph, which pushes the currency code to the
 * wrong side of the digits and drags the colon along with it. FSI … PDI makes
 * the value a self-contained run: it is laid out on its own, then placed as a
 * single neutral object in the Arabic sentence.
 *
 * Use this only for strings. Anything rendered as its own element should use
 * `<bdi>` (or `.numeric`) instead — same effect, no invisible characters in the
 * accessible name or in a copy-paste.
 */
export function isolate(value: string | number): string {
  // U+2068 FIRST STRONG ISOLATE … U+2069 POP DIRECTIONAL ISOLATE.
  return `⁨${value}⁩`;
}

/** Keeps the last `visible` characters, masking everything before them. */
export function maskTail(value: string, visible = 4): string {
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= visible) return "•".repeat(clean.length);
  return `${"•".repeat(Math.min(clean.length - visible, 12))}${clean.slice(-visible)}`;
}

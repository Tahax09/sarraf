import { secureFlag } from "@/lib/cookies";

/**
 * Display preferences that belong to the reader, not to the document.
 *
 * They ride a cookie for the same reason the theme does: the server renders the
 * `data-*` attributes into the first HTML response, so a reader who needs
 * larger text or higher contrast never sees a frame of the default. A
 * `localStorage` read after hydration would flash the wrong layout at exactly
 * the people least able to absorb it.
 *
 * `system` means "defer to the OS" — the panel does not override an operating
 * system that already says `prefers-reduced-motion`.
 */

export const A11Y_COOKIE = "SARAF_A11Y";

export const motionSettings = ["system", "reduced"] as const;
export const contrastSettings = ["normal", "high"] as const;
export const textSizeSettings = ["normal", "large", "larger"] as const;

export type MotionSetting = (typeof motionSettings)[number];
export type ContrastSetting = (typeof contrastSettings)[number];
export type TextSizeSetting = (typeof textSizeSettings)[number];

export type A11yPreferences = {
  motion: MotionSetting;
  contrast: ContrastSetting;
  textSize: TextSizeSetting;
};

export const defaultA11yPreferences: A11yPreferences = {
  motion: "system",
  contrast: "normal",
  textSize: "normal",
};

/**
 * Serialised as `motion:reduced,contrast:high,text:large`. A readable cookie
 * beats JSON here: it survives a manual edit, and anything unrecognised falls
 * back to the default rather than throwing during SSR.
 */
export function serializeA11yPreferences(prefs: A11yPreferences): string {
  return [
    `motion:${prefs.motion}`,
    `contrast:${prefs.contrast}`,
    `text:${prefs.textSize}`,
  ].join(",");
}

export function parseA11yPreferences(
  value: string | undefined,
): A11yPreferences {
  if (!value) return defaultA11yPreferences;

  const entries = new Map(
    value.split(",").map((pair) => {
      const [key, setting] = pair.split(":");
      return [key?.trim(), setting?.trim()] as const;
    }),
  );

  const pick = <T extends string>(
    raw: string | undefined,
    allowed: readonly T[],
    fallback: T,
  ): T => (allowed.includes(raw as T) ? (raw as T) : fallback);

  return {
    motion: pick(entries.get("motion"), motionSettings, "system"),
    contrast: pick(entries.get("contrast"), contrastSettings, "normal"),
    textSize: pick(entries.get("text"), textSizeSettings, "normal"),
  };
}

/**
 * A year, `SameSite=Lax`, not `httpOnly` — the client writes it so the change
 * applies without a reload. It carries no identity and no session material, so
 * it is deliberately outside the httpOnly session-cookie rule.
 */
export function a11yCookieString(prefs: A11yPreferences): string {
  const oneYear = 60 * 60 * 24 * 365;
  return `${A11Y_COOKIE}=${serializeA11yPreferences(prefs)}; max-age=${oneYear}; path=/; samesite=lax${secureFlag()}`;
}

/** The `data-*` attributes the stylesheet keys off. */
export function a11yDataAttributes(prefs: A11yPreferences) {
  return {
    "data-motion": prefs.motion,
    "data-contrast": prefs.contrast,
    "data-text": prefs.textSize,
  };
}

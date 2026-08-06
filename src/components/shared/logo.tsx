"use client";

import Image, { type StaticImageData } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { isLocale, localeDirection } from "@/i18n/routing";

import horizontalLtrNormal from "@/logo/LogoLTR-N.svg";
import horizontalLtrBlack from "@/logo/LogoLTR-B.svg";
import horizontalLtrWhite from "@/logo/LogoLTR-W.svg";
import horizontalRtlNormal from "@/logo/LogoRTL-N.svg";
import horizontalRtlBlack from "@/logo/LogoRTL-B.svg";
import horizontalRtlWhite from "@/logo/LogoRTL-W.svg";
import verticalNormal from "@/logo/LogoHN.svg";
import verticalBlack from "@/logo/LogoHB.svg";
import verticalWhite from "@/logo/LogoHW.svg";

/**
 * The one place a logo file is named. Selection is automatic:
 *
 * - theme: light picks `N` (normal) or `B` (black); dark always picks `W`,
 *   because the light artwork is drawn in the near-black brand color and
 *   disappears against the dark surface.
 * - direction: the horizontal lockup has an RTL and an LTR cut (the mark sits
 *   on the reading-start side); the vertical lockup is symmetric and has one.
 *
 * The `C` (colored) cuts ship in `src/logo/` but are not referenced. `N` is the
 * lockup this panel uses; carrying a second full-colour variant would only make
 * the choice ambiguous at call sites.
 */
type Orientation = "horizontal" | "vertical";
type Tone = "color" | "mono";

const ASSETS: Record<
  Orientation,
  Record<"rtl" | "ltr", { color: StaticImageData; mono: StaticImageData; dark: StaticImageData }>
> = {
  horizontal: {
    ltr: {
      color: horizontalLtrNormal,
      mono: horizontalLtrBlack,
      dark: horizontalLtrWhite,
    },
    rtl: {
      color: horizontalRtlNormal,
      mono: horizontalRtlBlack,
      dark: horizontalRtlWhite,
    },
  },
  vertical: {
    ltr: { color: verticalNormal, mono: verticalBlack, dark: verticalWhite },
    rtl: { color: verticalNormal, mono: verticalBlack, dark: verticalWhite },
  },
};

export function Logo({
  orientation = "horizontal",
  tone = "color",
  className,
  /** Set when the app name is already written next to the mark. */
  decorative = false,
}: {
  orientation?: Orientation;
  tone?: Tone;
  className?: string;
  decorative?: boolean;
}) {
  const { theme } = useTheme();
  const locale = useLocale();
  const t = useTranslations("app");

  const direction = isLocale(locale) ? localeDirection[locale] : "rtl";
  const source =
    theme === "dark"
      ? ASSETS[orientation][direction].dark
      : ASSETS[orientation][direction][tone];

  return (
    <Image
      src={source}
      // SVG is already resolution-independent; the optimizer would only re-encode it.
      unoptimized
      priority
      alt={decorative ? "" : t("name")}
      aria-hidden={decorative || undefined}
      className={cn("w-auto", orientation === "horizontal" ? "h-7" : "h-14", className)}
    />
  );
}

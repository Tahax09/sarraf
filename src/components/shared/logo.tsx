"use client";

import Image, { type StaticImageData } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { isLocale, localeDirection } from "@/i18n/routing";

import horizontalLtrColor from "@/logo/LogoLTR-C.svg";
import horizontalLtrBlack from "@/logo/LogoLTR-B.svg";
import horizontalLtrWhite from "@/logo/LogoLTR-W.svg";
import horizontalRtlColor from "@/logo/LogoRTL-C.svg";
import horizontalRtlBlack from "@/logo/LogoRTL-B.svg";
import horizontalRtlWhite from "@/logo/LogoRTL-W.svg";
import verticalColor from "@/logo/LogoHC.svg";
import verticalBlack from "@/logo/LogoHB.svg";
import verticalWhite from "@/logo/LogoHW.svg";

/**
 * The one place a logo file is named. Selection is automatic:
 *
 * - theme: light picks `C` (colored) or `B` (black); dark always picks `W`,
 *   because the colored artwork is drawn in the near-black brand color and
 *   disappears against the dark surface.
 * - direction: the horizontal lockup has an RTL and an LTR cut (the mark sits
 *   on the reading-start side); the vertical lockup is symmetric and has one.
 *
 * The `N` (normal) cuts ship in `src/logo/` but are not referenced: `C` is the
 * colored lockup this UI uses, and adding a second colored variant would only
 * make the choice ambiguous at call sites.
 */
type Orientation = "horizontal" | "vertical";
type Tone = "color" | "mono";

const ASSETS: Record<
  Orientation,
  Record<"rtl" | "ltr", { color: StaticImageData; mono: StaticImageData; dark: StaticImageData }>
> = {
  horizontal: {
    ltr: {
      color: horizontalLtrColor,
      mono: horizontalLtrBlack,
      dark: horizontalLtrWhite,
    },
    rtl: {
      color: horizontalRtlColor,
      mono: horizontalRtlBlack,
      dark: horizontalRtlWhite,
    },
  },
  vertical: {
    ltr: { color: verticalColor, mono: verticalBlack, dark: verticalWhite },
    rtl: { color: verticalColor, mono: verticalBlack, dark: verticalWhite },
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

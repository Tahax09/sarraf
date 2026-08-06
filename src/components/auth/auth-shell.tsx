"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Logo } from "@/components/shared/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AccessibilityTrigger } from "@/components/layout/accessibility-center";
import { formatYear } from "@/lib/format";
import loginBanner from "@/assests/Auth/loginbanner.svg";

/**
 * The frame every signed-out page shares: sign-in, password recovery, and
 * whatever else ends up outside the shell.
 *
 * It exists because these pages were drifting apart — one was a two-panel
 * layout, the other a card floating in the middle of an empty page — and an
 * operator who follows "forgot your password?" should not feel they have left
 * the product. The panels, the toolbar, the heading rhythm and the footer are
 * fixed here; the page supplies its title, its subtitle and its form.
 *
 * The order is source order, so the layout mirrors on its own: the brand panel
 * sits on the right in Arabic and the left in English, because a grid column
 * follows the page's direction without being told to.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  /** One line under the title. Optional — the OTP step has nothing to add. */
  subtitle?: string;
  children: ReactNode;
  /** Page-specific closing line, above the copyright. */
  footer?: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <BrandPanel />

      <div className="relative flex items-center justify-center bg-bg px-4 py-8">
        <AuthToolbar />

        <div className="w-full max-w-sm space-y-5">
          {/* The logo rides with the form only when the brand panel is gone. */}
          <div className="text-center lg:hidden">
            <Logo orientation="vertical" className="mx-auto h-16" decorative />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-fg">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
            ) : null}
          </div>

          {children}

          {footer ? (
            <p className="text-center text-[11px] text-fg-subtle">{footer}</p>
          ) : null}

          {/* The brand panel carries the copyright where it is visible; on a
              phone that panel is gone, so the form carries it instead. */}
          <p className="text-center text-[11px] text-fg-subtle lg:hidden">
            <Copyright />
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Language, theme and accessibility, at the top of the reading edge.
 *
 * All three are here for the same reason: this is the one part of the panel
 * with no header and no user menu, and the operator who most needs larger
 * text, more contrast or their own language is the one who cannot get past
 * this page without them. Waiting until after sign-in would be asking them to
 * read the form first.
 */
function AuthToolbar() {
  return (
    <div className="absolute top-4 end-4 flex items-center gap-1">
      <LocaleSwitcher showIcon />
      <ThemeToggle />
      <AccessibilityTrigger />
    </div>
  );
}

/**
 * The half of the page that says what the operator is signing in to.
 *
 * The artwork is the supplied banner: three blurred colour fields, drawn as
 * vectors rather than the 15 MB export of the same picture, so it costs about a
 * kilobyte and stays sharp at any panel height. It is decorative — `alt=""`,
 * and nothing on this side is needed to sign in — and it sits behind the
 * content rather than beside it, which is why the children are positioned.
 *
 * `object-cover` on a fixed 720×900 drawing means the blobs are cropped, not
 * squashed, whatever shape the column ends up; the composition survives it
 * because there is no subject to lose.
 */
function BrandPanel() {
  const t = useTranslations("auth");

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden border-e border-border bg-surface-muted p-10 lg:flex">
      <Image
        src={loginBanner}
        alt=""
        aria-hidden
        // Above the fold on the one page every session starts at.
        priority
        // The artwork is not symmetric — the heavy field sits low on one side —
        // so it turns with the page like every other directional graphic here,
        // and the weight stays on the same side as the reader's eye.
        className="rtl-flip pointer-events-none absolute inset-0 size-full object-cover"
      />

      <Logo className="relative h-9 w-auto" decorative />

      <div className="relative max-w-md">
        <p className="text-3xl leading-tight font-semibold text-balance text-fg">
          {t("brandHeadline")}
        </p>
        <p className="mt-3 text-sm text-pretty text-fg-muted">
          {t("brandSubcopy")}
        </p>
      </div>

      <p className="relative text-xs text-fg-subtle">
        <Copyright />
      </p>
    </div>
  );
}

/** These pages are outside the shell, so they carry their own footer line. */
function Copyright() {
  const tApp = useTranslations("app");
  return (
    <>{tApp("copyright", { year: formatYear(new Date().getFullYear()) })}</>
  );
}

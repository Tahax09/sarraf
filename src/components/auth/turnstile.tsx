"use client";

import { useEffect, useId, useRef } from "react";
import { useLocale } from "next-intl";
import { env } from "@/lib/env";

/**
 * Cloudflare Turnstile widget.
 *
 * Rendered only where `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is configured: a
 * deployment without one shows nothing and sends no token, so a backend that
 * does not verify a token is unaffected. The site key is public by design; the
 * secret half is the backend's and never reaches this bundle.
 *
 * The token is handed to the caller rather than stored: it belongs in the login
 * request and nowhere else — not in storage, not in a query string.
 */

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      language?: string;
      theme?: "auto" | "light" | "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    /** Called by the script once the widget API is ready. */
    onSarafTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = "cf-turnstile";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onSarafTurnstileLoad";

export function isTurnstileEnabled(): boolean {
  return env.turnstileSiteKey !== null;
}

export function Turnstile({
  onToken,
  nonce,
}: {
  /** Fresh token, or null when it expired or the challenge failed. */
  onToken: (token: string | null) => void;
  /** Per-request CSP nonce; without it the script is refused by the policy. */
  nonce?: string;
}) {
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const id = useId();

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    const siteKey = env.turnstileSiteKey;
    const container = containerRef.current;
    if (!siteKey || !container) return;

    let widgetId: string | null = null;

    const draw = () => {
      if (!window.turnstile || widgetId !== null) return;
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        language: locale,
        callback: (token) => onTokenRef.current(token),
        // A stale token is worse than none: it fails verification server-side
        // and the operator is told their credentials were wrong.
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
      });
    };

    window.onSarafTurnstileLoad = draw;

    if (window.turnstile) {
      draw();
    } else if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      // `strict-dynamic` trusts what a nonce-carrying script loads, so the
      // widget's own resources need no host allowlist of their own.
      if (nonce) script.nonce = nonce;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetId !== null) window.turnstile?.remove(widgetId);
    };
  }, [locale, nonce]);

  if (!env.turnstileSiteKey) return null;

  // `dir="ltr"`: the widget lays itself out and must not be mirrored by the
  // Arabic page around it.
  return <div ref={containerRef} id={id} dir="ltr" className="min-h-[65px]" />;
}

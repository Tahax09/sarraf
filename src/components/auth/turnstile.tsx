"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
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
      /** Cloudflare passes its numeric error code, e.g. `110200`. */
      "error-callback": (code?: string) => void;
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
  const t = useTranslations("auth");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const id = useId();
  /*
   * What the widget is doing, because it is allowed to fail.
   *
   * A challenge that never draws — the site key does not list this hostname,
   * the script was blocked, the network dropped it — used to leave a blank gap
   * above a sign-in button that stayed disabled with nothing said. The operator
   * has no way to tell that from a broken password field. So the failure is
   * shown, with the code Cloudflare gave, and a way to try again.
   */
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [code, setCode] = useState<string | null>(null);
  // Bumped to re-run the effect: a failed challenge is retried by drawing a
  // fresh one, which is what Cloudflare's own guidance says to do.
  const [attempt, setAttempt] = useState(0);

  const fail = useCallback((reason?: string) => {
    setStatus("failed");
    setCode(reason ?? null);
    onTokenRef.current(null);
  }, []);

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
        callback: (token) => {
          setStatus("ready");
          setCode(null);
          onTokenRef.current(token);
        },
        // A stale token is worse than none: it fails verification server-side
        // and the operator is told their credentials were wrong.
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": (reason) => fail(reason),
      });
      setStatus("ready");
    };

    window.onSarafTurnstileLoad = draw;

    if (window.turnstile) {
      draw();
    } else {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        existing.addEventListener("error", () => fail());
      } else {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        // The script is fetched cross-origin and blocked outright by the policy
        // if it carries no nonce, which looks identical to a network failure
        // from here — both end up in this handler.
        script.onerror = () => fail();
        // `strict-dynamic` trusts what a nonce-carrying script loads, so the
        // widget's own resources need no host allowlist of their own.
        if (nonce) script.nonce = nonce;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetId !== null) window.turnstile?.remove(widgetId);
    };
  }, [locale, nonce, attempt, fail]);

  if (!env.turnstileSiteKey) return null;

  return (
    <div className="space-y-2">
      {/* No `dir` of its own: Cloudflare draws the challenge in the language it
          was handed, right-to-left included, so the box follows the page like
          everything else on it rather than sitting left-aligned in an Arabic
          form. */}
      <div ref={containerRef} id={id} className="min-h-[65px]" />

      {status === "failed" ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            {t("captchaFailed")}
            {/* The code is what a support call turns into an answer: 110200 is
                "this hostname is not on the site key", and nothing else here
                can tell the operator that. */}
            {code ? <span className="identifier ms-1">({code})</span> : null}
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setCode(null);
                setAttempt((n) => n + 1);
              }}
              className="ms-2 underline hover:no-underline"
            >
              {t("captchaRetry")}
            </button>
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Environment access. Every value is read through here so a missing variable
 * fails loudly at build/start time instead of producing an undefined base URL
 * at runtime. Never inline a base URL, key, or token anywhere else in source.
 */

type PublicEnv = {
  apiBaseUrl: string;
  appName: string;
  /**
   * Cloudflare Turnstile site key. Optional by design: a deployment without one
   * shows no widget and sends no token, which is the correct behaviour for a
   * backend that does not verify one. A site key is public — the secret half
   * lives on the backend and never reaches this bundle.
   */
  turnstileSiteKey: string | null;
};

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
        `Add it to .env.local (see .env.example) before starting the app.`,
    );
  }
  return value.trim();
}

function optional(value: string | undefined, fallback: string): string {
  return value && value.trim() !== "" ? value.trim() : fallback;
}

/** A feature that is simply off when the variable is absent. */
function nullable(value: string | undefined): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

/**
 * NOTE: `process.env.NEXT_PUBLIC_*` must be referenced statically (not via a
 * computed key) for Next.js to inline it into the client bundle.
 */
export const env: PublicEnv = {
  apiBaseUrl: required(
    "NEXT_PUBLIC_API_BASE_URL",
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ),
  appName: optional(process.env.NEXT_PUBLIC_APP_NAME, "Saraf"),
  turnstileSiteKey: nullable(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
};

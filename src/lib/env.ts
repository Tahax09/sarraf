/**
 * Environment access. Every value is read through here so a missing variable
 * fails loudly at build/start time instead of producing an undefined base URL
 * at runtime. Never inline a base URL, key, or token anywhere else in source.
 */

type PublicEnv = {
  apiBaseUrl: string;
  appName: string;
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
};

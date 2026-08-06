/**
 * Feature flags, as small as a flag system can be and still be useful.
 *
 * A banking panel cannot ship a half-finished approval screen to a branch and
 * hope nobody clicks it, and it cannot hold a long-lived branch either — both
 * end the same way. Flags are how a change reaches `main` before it reaches
 * operators.
 *
 * The design constraints that produced this shape:
 *
 * - **Build-time, not runtime.** The flag set comes from an environment
 *   variable, so it is decided by whoever deploys and cannot be flipped by
 *   anyone holding a browser. A runtime service would be a nicer product and a
 *   worse security boundary — the backend must enforce every rule a flag
 *   appears to relax, because a flag is a UI decision and the UI is not a
 *   security boundary.
 * - **Closed by default.** An unknown or absent flag is off. A typo turns a
 *   feature off, never on.
 * - **Enumerated.** `KNOWN_FLAGS` is the list; `useFlag("whatever")` will not
 *   type-check. It is also the list a reviewer reads to find flags that
 *   outlived their rollout, which is the failure mode of every flag system
 *   that lets callers invent names.
 */

/**
 * Every flag this build understands, with what it gates. Delete an entry the
 * moment its feature is unconditional — a flag that is always on is a branch
 * in the code that nobody tests the other half of.
 */
export const KNOWN_FLAGS = {
  /** Emits Core Web Vitals and navigation timings to the registered sink. */
  telemetry: "Client telemetry: Web Vitals, navigation and request timings.",
  /** The executive/branch analytics surfaces, while their KPIs are being validated. */
  advancedAnalytics: "Executive and branch-performance analytics dashboards.",
} as const;

export type FeatureFlag = keyof typeof KNOWN_FLAGS;

/**
 * `NEXT_PUBLIC_FEATURE_FLAGS=telemetry,advancedAnalytics`
 *
 * Referenced statically so Next.js inlines it into the client bundle; a
 * computed key silently yields `undefined` in the browser.
 */
const raw = process.env.NEXT_PUBLIC_FEATURE_FLAGS ?? "";

const enabled: ReadonlySet<string> = new Set(
  raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
);

/**
 * Warns once, in development, about a name nobody will ever read as enabled.
 * A silent no-op here is hours of "the flag is set and nothing happened".
 */
if (process.env.NODE_ENV === "development") {
  for (const name of enabled) {
    if (!(name in KNOWN_FLAGS)) {
      console.warn(
        `[flags] "${name}" is set but no such flag exists. Known flags: ` +
          `${Object.keys(KNOWN_FLAGS).join(", ")}.`,
      );
    }
  }
}

/** Server- and client-safe: the value is inlined at build time. */
export function isEnabled(flag: FeatureFlag): boolean {
  return enabled.has(flag);
}

/**
 * The flags this build was compiled with, for the diagnostics panel. Returned
 * as a sorted list of every known flag and its state, not just the enabled
 * ones — "which flags exist" is the question support actually has.
 */
export function flagStates(): { flag: FeatureFlag; on: boolean }[] {
  return (Object.keys(KNOWN_FLAGS) as FeatureFlag[])
    .sort()
    .map((flag) => ({ flag, on: enabled.has(flag) }));
}

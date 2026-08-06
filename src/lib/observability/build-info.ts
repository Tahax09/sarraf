/**
 * What this build *is*.
 *
 * When a branch reports "the transfer screen froze", the first question is
 * always which build they were looking at, and the second is whether it is the
 * one that is supposed to be there. A version string an operator can read out
 * of the footer answers both in one sentence and costs nothing to carry.
 *
 * Every field is injected at build time and is deliberately non-fatal when
 * absent: a developer running `next dev` has no commit to stamp, and the app
 * must not refuse to start over a diagnostic. `env.ts` keeps the loud failures
 * for values the app genuinely cannot run without.
 *
 * None of this is secret. A commit SHA and a build timestamp are visible in
 * any deployment's static assets; naming them explicitly makes support faster
 * without telling an attacker anything the bundle did not already say.
 */

export type BuildInfo = {
  /** Semantic version from package.json, injected by the build. */
  version: string;
  /** Short commit SHA, or `null` outside CI. */
  commit: string | null;
  /** ISO-8601 build timestamp, or `null` when the build did not stamp one. */
  builtAt: string | null;
  /**
   * Which deployment this is: `production`, `staging`, `development`, or
   * whatever the operator's infrastructure calls it. Free text on purpose —
   * an enum here would be a lie the moment someone adds a second staging.
   */
  environment: string;
};

/**
 * NOTE: `process.env.NEXT_PUBLIC_*` must be referenced statically for Next.js
 * to inline it into the client bundle. A computed key silently yields
 * `undefined` in the browser.
 */
export const buildInfo: BuildInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.0.0-dev",
  commit: process.env.NEXT_PUBLIC_BUILD_SHA?.trim().slice(0, 12) || null,
  builtAt: process.env.NEXT_PUBLIC_BUILD_TIME?.trim() || null,
  environment:
    process.env.NEXT_PUBLIC_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV ||
    "development",
};

/**
 * One line for a footer, a support ticket, or a screenshot: `1.4.0 · a1b2c3d`.
 * The separator is a middle dot rather than a slash so it survives being
 * pasted into a URL bar or a chat client without being turned into a link.
 */
export function buildLabel(info: BuildInfo = buildInfo): string {
  return info.commit ? `${info.version} · ${info.commit}` : info.version;
}

/** True when this build was produced by CI rather than a developer machine. */
export function isStampedBuild(info: BuildInfo = buildInfo): boolean {
  return info.commit !== null;
}

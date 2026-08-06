#!/usr/bin/env node
/**
 * `next build`, with the build stamped.
 *
 * The version, commit and timestamp have to be baked in at build time — they
 * are `NEXT_PUBLIC_*` values inlined into the client bundle, and there is no
 * later moment at which they could be discovered. This wrapper is how they get
 * there without every deployment pipeline having to re-derive them.
 *
 * Values already present in the environment win. CI knows the tag it is
 * building and the SHA it checked out; a script guessing from `git` would be
 * wrong exactly when it matters, on a detached head or a shallow clone.
 *
 * Nothing here is secret, and nothing here may become secret: everything this
 * script exports reaches the browser. See `src/lib/observability/build-info.ts`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** `git` may be absent (a container build from a tarball); that is not fatal. */
function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function packageVersion() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return pkg.version ?? "0.0.0";
}

const env = {
  ...process.env,
  NEXT_PUBLIC_APP_VERSION:
    process.env.NEXT_PUBLIC_APP_VERSION || packageVersion(),
  NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA || gitSha(),
  NEXT_PUBLIC_BUILD_TIME:
    process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
};

console.log(
  `Building ${env.NEXT_PUBLIC_APP_VERSION} ` +
    `(${env.NEXT_PUBLIC_BUILD_SHA || "no commit"}) ` +
    `for ${env.NEXT_PUBLIC_ENVIRONMENT || "development"}`,
);

const result = spawnSync("npx", ["next", "build"], {
  cwd: ROOT,
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

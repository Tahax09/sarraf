/**
 * Runs the JavaScript budget in `e2e/performance.spec.ts` against a production
 * build.
 *
 * The suite's normal server is `next dev`, whose unminified chunks are several
 * times the size of what ships, so a budget measured there would be a number
 * about the dev server. This builds, serves the build on a port of its own so
 * it does not fight the dev server the developer already has running, runs the
 * one spec, and takes the server back down.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * Which specs to run against the server this script stands up. Some assertions
 * are only meaningful on a production build — the JavaScript budget, and the
 * CSP's *absence* of `unsafe-inline` and `unsafe-eval`, which `next dev`
 * relaxes on purpose — and they all want the same expensive build. Passing
 * them as arguments keeps one build serving all of them.
 */
const specs = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
if (specs.length === 0) specs.push("performance");

const PORT = Number(process.env.PERF_PORT ?? 3200);
const BASE = `http://localhost:${PORT}`;

/** Fixtures, and Cloudflare's always-passes Turnstile key: no backend involved. */
const env = {
  ...process.env,
  NEXT_PUBLIC_API_MODE: "fixtures",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  NEXT_PUBLIC_API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.example.invalid",
  NEXT_TELEMETRY_DISABLED: "1",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env, ...options });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  throw new Error(`${BASE} never came up`);
}

console.log("› building");
await run("npx", ["next", "build"]);

console.log(`› serving on ${PORT}`);
const server = spawn("npx", ["next", "start", "--port", String(PORT)], {
  stdio: "ignore",
  env,
});

let failure = null;
try {
  await waitForServer();
  console.log(`› running ${specs.join(", ")}`);
  await run("npx", ["playwright", "test", "--project=desktop", ...specs], {
    env: { ...env, E2E_PORT: String(PORT), E2E_PROD: "1" },
  });
} catch (error) {
  failure = error;
} finally {
  server.kill("SIGTERM");
}

if (failure) {
  console.error(failure.message);
  process.exit(1);
}

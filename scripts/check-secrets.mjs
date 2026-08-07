#!/usr/bin/env node
/**
 * Refuses to let a credential into the tree.
 *
 * GitHub's own push protection and CodeQL both run on this repository, and
 * both are better at this than a regexp. They are also *after the fact*: push
 * protection fires once the commit exists, and a secret that has been pushed
 * to a public remote is burned whether or not the push was blocked. This runs
 * before the commit, in the same place `npm run lint` does, and its whole job
 * is to make the mistake cost thirty seconds instead of a key rotation.
 *
 * Two rules, matching how this codebase actually leaks:
 *
 * 1. **Known credential shapes.** Provider tokens with recognisable prefixes,
 *    PEM private keys, long base64 blobs assigned to something called a secret.
 * 2. **Hardcoded endpoints and keys where env vars belong.** `env.ts` exists so
 *    that no base URL is ever written in source; a literal `https://api.` in a
 *    source file is either a mistake or a comment, and the difference is worth
 *    a reviewer's attention.
 *
 * False positives are handled by making the pattern narrower, not by adding an
 * ignore list — a scanner people silence is a scanner people ignore. The one
 * exception is `.env.example` and this file, which have to contain examples.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Files that are allowed to contain the shapes below, and why. */
const ALLOWED = new Set([
  // Documents the variables; the values are Cloudflare's public test keys.
  ".env.example",
  // Contains the patterns themselves.
  "scripts/check-secrets.mjs",
  // Names the test keys and explains why they are public.
  "docs/SECURITY.md",
  "docs/DEPLOYMENT.md",
]);

const RULES = [
  {
    name: "Private key block",
    // A PEM header is never a false positive.
    pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    name: "Provider token",
    // GitHub (ghp_/gho_/ghs_), Slack (xox…), Stripe (sk_live), AWS (AKIA).
    pattern: /\b(gh[pousr]_[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk_live_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})\b/,
  },
  {
    name: "Assigned secret literal",
    // `secret = "…"` / `apiKey: '…'` / `password="…"` with a value long enough
    // to be real. Short values are placeholders, and `process.env.X` is the
    // correct form this rule is pushing people towards.
    //
    // A leading `/` is excluded: `password: "/profile/password"` is an
    // endpoint path, and endpoints.ts is full of them by design.
    pattern:
      /\b(api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password)\b\s*[:=]\s*["'`][^"'`\s${}/][^"'`\s${}]{15,}["'`]/i,
  },
  {
    name: "Hardcoded API base URL",
    // Every base URL comes from the environment (src/lib/env.ts). A literal
    // one in source is the bug that file exists to prevent.
    //
    // `.invalid` and `example.` are reserved by RFC 2606 precisely so they can
    // be written down; a line that also mentions `process.env` is a fallback
    // for a variable, which is the pattern being asked for rather than avoided.
    pattern: /["'`]https?:\/\/(api|backend|gateway)[.\-][^"'`\s]+["'`]/i,
    skip: (line) =>
      line.includes("process.env") ||
      /\.invalid\b/.test(line) ||
      /\bexample\./.test(line),
  },
];

/** Tracked files only: node_modules and build output are not ours to police. */
function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((file) => !/\.(png|jpe?g|gif|svg|ico|webp|woff2?|pdf|lock)$/i.test(file))
    .filter((file) => file !== "package-lock.json");
}

const findings = [];

for (const file of trackedFiles()) {
  if (ALLOWED.has(file)) continue;

  let contents;
  try {
    contents = readFileSync(path.join(ROOT, file), "utf8");
  } catch {
    continue; // Deleted between listing and reading, or not UTF-8.
  }

  contents.split("\n").forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.skip?.(line)) continue;
      if (rule.pattern.test(line)) {
        findings.push({
          file,
          line: index + 1,
          rule: rule.name,
          // The match is not printed. Echoing a candidate secret into CI logs
          // would publish the thing this script exists to keep unpublished.
          preview: line.trim().slice(0, 40).replace(/\S/g, (c, i) => (i < 20 ? c : "·")),
        });
      }
    }
  });
}

if (findings.length === 0) {
  console.log("✓ No credential-shaped strings in tracked files.");
  process.exit(0);
}

console.error(`✗ ${findings.length} possible secret(s):\n`);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}  ${finding.rule}`);
  console.error(`      ${finding.preview}…\n`);
}
console.error(
  "If this is a real credential: rotate it, then remove it. Values belong in\n" +
    "the environment (src/lib/env.ts), never in source. If the pattern is wrong,\n" +
    "narrow the rule in scripts/check-secrets.mjs — do not add an exception.",
);
process.exit(1);

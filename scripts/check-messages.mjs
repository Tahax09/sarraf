#!/usr/bin/env node
/**
 * The two message catalogues must carry exactly the same keys.
 *
 * A missing key does not crash next-intl in production — it renders the key
 * path, so `dashboard.quickDeposit` appears on screen in place of a label. That
 * is the kind of defect that reaches a branch rather than a reviewer, so it is
 * a build gate rather than a lint rule.
 *
 * Also refuses an empty string: a key that exists but says nothing is the same
 * blank label with a passing test.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const locales = ["en", "ar"];

/** Flattens to dotted paths so the report names the key, not the branch. */
function flatten(node, prefix = "") {
  const out = new Map();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of flatten(value, path)) out.set(k, v);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

const catalogues = new Map(
  locales.map((locale) => [
    locale,
    flatten(
      JSON.parse(readFileSync(join(root, "messages", `${locale}.json`), "utf8")),
    ),
  ]),
);

const problems = [];

for (const [locale, entries] of catalogues) {
  for (const [other, otherEntries] of catalogues) {
    if (other === locale) continue;
    for (const key of entries.keys()) {
      if (!otherEntries.has(key)) problems.push(`${other}: missing ${key}`);
    }
  }
  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim() === "") {
      problems.push(`${locale}: empty value for ${key}`);
    }
  }
}

if (problems.length > 0) {
  console.error("Translation catalogues disagree:\n");
  for (const problem of [...new Set(problems)].sort()) {
    console.error(`  ${problem}`);
  }
  process.exit(1);
}

const count = catalogues.get(locales[0]).size;
console.log(`Translation catalogues agree — ${count} keys in ${locales.join(", ")}.`);

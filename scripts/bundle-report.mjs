#!/usr/bin/env node
/**
 * What is actually in the bundle, by weight.
 *
 * This is the *composition* half of the performance picture. The other half —
 * how much JavaScript a given route pulls over the network — is measured by
 * `e2e/performance.spec.ts`, which drives a real browser and is the number the
 * budget gates on. Neither replaces the other: a route can stay inside its
 * budget while one dependency quietly doubles, and this is where that shows.
 *
 * Deliberately dependency-free. A bundle analyser is one more package in a
 * repository that ships to a bank, and everything needed here is a directory
 * listing and gzip, both of which Node already has.
 *
 * Sizes are gzipped, because that is what crosses the wire. Raw bytes are
 * printed beside them only to make a badly-compressing chunk (an embedded
 * asset, a data table) obvious.
 *
 * Usage:
 *   npm run build && node scripts/bundle-report.mjs [--json report.json]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHUNKS = path.join(ROOT, ".next/static/chunks");

/** How many of the heaviest chunks to name. Beyond this it is noise. */
const TOP_N = 15;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const kb = (bytes) => Math.round(bytes / 102.4) / 10;

let files;
try {
  files = walk(CHUNKS);
} catch {
  console.error(
    "No .next/static/chunks — run `npm run build` before the bundle report.",
  );
  process.exit(1);
}

const chunks = files
  .map((file) => {
    const source = readFileSync(file);
    return {
      // The hash in a chunk name changes every build; the path relative to the
      // chunks directory is what a reader can compare between two runs.
      file: path.relative(CHUNKS, file),
      raw: statSync(file).size,
      gzip: gzipSync(source, { level: 9 }).length,
    };
  })
  .sort((a, b) => b.gzip - a.gzip);

const totals = chunks.reduce(
  (sum, chunk) => ({ raw: sum.raw + chunk.raw, gzip: sum.gzip + chunk.gzip }),
  { raw: 0, gzip: 0 },
);

console.log(`\nBundle report — ${chunks.length} chunks`);
console.log(`Total: ${kb(totals.gzip)} KB gzipped (${kb(totals.raw)} KB raw)\n`);
console.log(`Heaviest ${Math.min(TOP_N, chunks.length)}:`);
console.log("  gzip KB    raw KB   chunk");
for (const chunk of chunks.slice(0, TOP_N)) {
  console.log(
    `  ${String(kb(chunk.gzip)).padStart(7)}  ${String(kb(chunk.raw)).padStart(8)}   ${chunk.file}`,
  );
}

console.log(
  "\nThis is composition, not per-route weight. `npm run perf:budget` measures\n" +
    "what a route actually transfers, and that is the number the budget gates on.\n",
);

const jsonFlag = process.argv.indexOf("--json");
if (jsonFlag !== -1) {
  const target = process.argv[jsonFlag + 1] ?? "bundle-report.json";
  writeFileSync(
    path.resolve(ROOT, target),
    `${JSON.stringify({ totals, chunks }, null, 2)}\n`,
  );
  console.log(`Wrote ${target}`);
}

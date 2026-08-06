#!/usr/bin/env node
/**
 * Structural rules that a reviewer cannot reliably hold in their head.
 *
 * Type checking proves the code compiles; ESLint proves each file is written
 * the way the team writes files. Neither notices that a utility started
 * importing a React component, or that two modules quietly began importing each
 * other. Both are cheap to introduce, expensive to unpick a year later, and
 * invisible in a diff — which is exactly the shape of a problem worth spending
 * a build step on.
 *
 * Three rules, each with a reason:
 *
 * 1. **No import cycles.** A cycle makes module initialisation order load
 *    bearing. It works until a bundler or a new entry point evaluates the ring
 *    from the other side, and then it is an undefined at module scope with no
 *    stack trace worth reading.
 *
 * 2. **Layers point one way.** `lib` is framework-agnostic logic, `components`
 *    render it, `app` routes to them. A `lib` module that imports a component
 *    cannot be tested, reused, or reasoned about without a DOM, and the
 *    direction of dependency stops describing the design.
 *
 * 3. **No deep-reaching into a sibling's private folder.** Importing another
 *    module's `__tests__` is always a mistake; it is the one such rule the
 *    layout here makes checkable.
 *
 * Run: `npm run check:architecture`. Exit code 1 on any violation, with the
 * offending edge printed — the fix is nearly always to move the file rather
 * than to add an exception.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Source files, tests included: a test that closes a cycle is still a cycle. */
function sourceFiles() {
  const out = execFileSync(
    "find",
    ["src", "-type", "f", "-name", "*.ts", "-o", "-type", "f", "-name", "*.tsx"],
    { cwd: ROOT, encoding: "utf8" },
  );
  return out.trim().split("\n").filter(Boolean);
}

const withoutExtension = (file) => file.replace(/\.(tsx|ts)$/, "");

/**
 * Only `@/`-aliased imports are resolved. Relative imports inside one folder
 * cannot cross a layer boundary, and package imports are not ours to police.
 */
function importsOf(file, known) {
  const source = readFileSync(path.join(ROOT, file), "utf8");
  const specifiers = [
    ...source.matchAll(/from\s+"(@\/[^"]+)"/g),
    ...source.matchAll(/import\(\s*"(@\/[^"]+)"\s*\)/g),
  ].map((match) => `src/${match[1].slice(2)}`);

  return specifiers
    .map((specifier) =>
      known.has(specifier)
        ? specifier
        : known.has(`${specifier}/index`)
          ? `${specifier}/index`
          : null,
    )
    .filter(Boolean);
}

function buildGraph() {
  const files = sourceFiles();
  const known = new Set(files.map(withoutExtension));
  const graph = new Map();
  for (const file of files) {
    graph.set(withoutExtension(file), importsOf(file, known));
  }
  return graph;
}

/** Depth-first, reporting the ring itself rather than just the pair. */
function findCycles(graph) {
  const state = new Map();
  const stack = [];
  const cycles = [];

  function visit(node) {
    state.set(node, "open");
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) {
      if (state.get(dependency) === "open") {
        const ring = stack.slice(stack.indexOf(dependency));
        cycles.push([...ring, dependency].join("\n       → "));
      } else if (!state.has(dependency)) {
        visit(dependency);
      }
    }
    stack.pop();
    state.set(node, "done");
  }

  for (const node of graph.keys()) if (!state.has(node)) visit(node);
  return cycles;
}

/** Lower index may not import higher index. */
const LAYERS = ["src/lib/", "src/components/", "src/app/"];

function layerOf(file) {
  return LAYERS.findIndex((prefix) => file.startsWith(prefix));
}

function findLayerViolations(graph) {
  const violations = [];
  for (const [file, dependencies] of graph) {
    // A test may import whatever it exercises — several component tests render
    // the route page that composes them, which is the point of the test. Tests
    // are still walked for cycles above; only the direction rule exempts them.
    if (file.includes("__tests__")) continue;
    const from = layerOf(file);
    if (from === -1) continue;
    for (const dependency of dependencies) {
      const to = layerOf(dependency);
      if (to > from) {
        violations.push(
          `${file}\n       → ${dependency}   (${LAYERS[from]} must not import ${LAYERS[to]})`,
        );
      }
    }
  }
  return violations;
}

function findTestImports(graph) {
  const violations = [];
  for (const [file, dependencies] of graph) {
    if (file.includes("__tests__")) continue;
    for (const dependency of dependencies) {
      if (dependency.includes("__tests__")) {
        violations.push(`${file}\n       → ${dependency}`);
      }
    }
  }
  return violations;
}

const graph = buildGraph();
const checks = [
  ["Import cycles", findCycles(graph)],
  ["Layering violations", findLayerViolations(graph)],
  ["Production code importing tests", findTestImports(graph)],
];

let failed = false;
for (const [name, violations] of checks) {
  if (violations.length === 0) {
    console.log(`✓ ${name}: none`);
    continue;
  }
  failed = true;
  console.error(`✗ ${name}: ${violations.length}`);
  for (const violation of violations) console.error(`     ${violation}`);
}

if (failed) {
  console.error(
    "\nMoving the file usually fixes this. If a rule is genuinely wrong, " +
      "change the rule in scripts/check-architecture.mjs and say why in the " +
      "commit — do not add a per-file exception.",
  );
  process.exit(1);
}

console.log(`\nArchitecture rules hold across ${graph.size} modules.`);

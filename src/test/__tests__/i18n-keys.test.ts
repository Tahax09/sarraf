import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";

/**
 * Guards against the class of bug that shipped `table.rowNumber` as visible
 * text: next-intl renders the key path itself when a message is missing, so a
 * typo or a forgotten catalogue entry looks like a translated string until a
 * human reads the screen.
 *
 * Every literal `t("…")` in `src/` is resolved against both catalogues here.
 */
const SRC = join(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === "__tests__" ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

function lookup(catalogue: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      catalogue,
    );
}

/** `const tf = useTranslations("fields")` → `tf` resolves under `fields`. */
const HOOK = /(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*(?:"([\w.]+)")?\s*\)/g;

/**
 * A key is reported as one or more candidate paths: a file can hold several
 * components, each binding `t` to a different namespace, and the regex cannot
 * tell their scopes apart. Resolving under any of the file's bindings counts.
 */
function usages(source: string): string[][] {
  const namespaces = new Map<string, Set<string>>();
  for (const match of source.matchAll(HOOK)) {
    const bound = namespaces.get(match[1]) ?? new Set<string>();
    bound.add(match[2] ?? "");
    namespaces.set(match[1], bound);
  }

  const found: string[][] = [];
  for (const [variable, bindings] of namespaces) {
    // `t("key")`, `t("key", {…})` and `t.rich("key", …)`. Template literals are
    // dynamic (enum codes, status names) and are covered by labels.test.tsx.
    const call = new RegExp(`\\b${variable}(?:\\.rich|\\.markup)?\\(\\s*"([\\w.]+)"`, "g");
    for (const match of source.matchAll(call)) {
      found.push(
        [...bindings].map((namespace) =>
          namespace ? `${namespace}.${match[1]}` : match[1],
        ),
      );
    }
  }
  return found;
}

function flatten(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message catalogues", () => {
  const files = sourceFiles(SRC);

  it("resolves every literal translation key used in src/", () => {
    const missing: string[] = [];
    for (const file of files) {
      for (const candidates of usages(readFileSync(file, "utf8"))) {
        for (const [locale, catalogue] of [
          ["ar", ar],
          ["en", en],
        ] as const) {
          const resolved = candidates.some(
            (key) => typeof lookup(catalogue, key) === "string",
          );
          if (!resolved) {
            missing.push(
              `${locale}: ${candidates.join(" | ")} (${file.slice(SRC.length + 1)})`,
            );
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps the Arabic and English catalogues in step", () => {
    const arKeys = flatten(ar).sort();
    const enKeys = flatten(en).sort();
    expect(enKeys.filter((key) => !arKeys.includes(key))).toEqual([]);
    expect(arKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it("finds keys at all — a silent zero would make this suite useless", () => {
    const total = files.reduce(
      (sum, file) => sum + usages(readFileSync(file, "utf8")).length,
      0,
    );
    expect(total).toBeGreaterThan(300);
  });
});

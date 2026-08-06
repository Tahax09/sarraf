import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const baseConfig = createJestConfig({
  testEnvironment: "jest-environment-jsdom",
  setupFiles: ["<rootDir>/jest.env.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/node_modules/"],
  collectCoverageFrom: [
    "src/lib/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
  ],
});

/**
 * A ratchet, not a target. The numbers sit just under what the suite actually
 * covers today, so the gate fails when a change removes coverage and never
 * fails for an unrelated reason. Raise them when the real figure moves;
 * `npm run test:coverage` prints it.
 *
 * The `src/lib` floor is higher because that is the pure logic — money
 * formatting, permission resolution, workbook writing, redirect validation — where
 * an uncovered branch is a defect rather than an unrendered variant.
 *
 * It is keyed on the directory, not on `src/lib/**\/*.ts`. Jest reads a glob key
 * as a threshold applied to each matching file *individually*, so that spelling
 * demanded 70% of every one of the sixty-odd files under `src/lib` — including
 * the fixture generators and the thin browser wrappers — and the gate was
 * failing on thirty-seven counts the day it was switched on. A directory key is
 * the aggregate the paragraph above describes.
 *
 * Applied after `next/jest` rather than through it: its option type does not
 * carry the coverage keys, which are Jest's own.
 */
const coverageThreshold = {
  global: { statements: 57, branches: 50, functions: 50, lines: 57 },
  "./src/lib/": {
    statements: 66,
    branches: 53,
    functions: 58,
    lines: 69,
  },
};

/**
 * next/jest hard-codes the list of `node_modules` packages it will transform.
 * next-intl and use-intl are ESM-only, so they are added to that allow-list
 * here — patching the generated patterns is the only way in.
 */
export default async function config() {
  const resolved = await baseConfig();
  return {
    ...resolved,
    coverageThreshold,
    transformIgnorePatterns: (resolved.transformIgnorePatterns ?? []).map(
      (pattern) =>
        pattern.startsWith("/node_modules/(?!.pnpm)")
          ? pattern.replace("(?!(geist|", "(?!(next-intl|use-intl|@formatjs|intl-messageformat|geist|")
          : pattern,
    ),
  };
}

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
 * formatting, permission resolution, CSV escaping, redirect validation — where
 * an uncovered branch is a defect rather than an unrendered variant.
 *
 * Applied after `next/jest` rather than through it: its option type does not
 * carry the coverage keys, which are Jest's own.
 */
const coverageThreshold = {
  global: { statements: 57, branches: 50, functions: 50, lines: 57 },
  "src/lib/**/*.ts": {
    statements: 70,
    branches: 62,
    functions: 66,
    lines: 70,
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

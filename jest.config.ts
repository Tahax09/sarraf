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
 * next/jest hard-codes the list of `node_modules` packages it will transform.
 * next-intl and use-intl are ESM-only, so they are added to that allow-list
 * here — patching the generated patterns is the only way in.
 */
export default async function config() {
  const resolved = await baseConfig();
  return {
    ...resolved,
    transformIgnorePatterns: (resolved.transformIgnorePatterns ?? []).map(
      (pattern) =>
        pattern.startsWith("/node_modules/(?!.pnpm)")
          ? pattern.replace("(?!(geist|", "(?!(next-intl|use-intl|@formatjs|intl-messageformat|geist|")
          : pattern,
    ),
  };
}

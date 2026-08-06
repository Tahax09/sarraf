import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Jest's HTML report. Generated, vendored, and full of directives ESLint
    // has opinions about — with `--max-warnings=0` in CI, one local
    // `npm run test:coverage` would otherwise turn the lint gate red.
    "coverage/**",
  ]),
]);

export default eslintConfig;

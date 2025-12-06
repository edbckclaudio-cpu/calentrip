import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Ignored paths (migrated from .eslintignore)
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "android/**",
    "dist/**",
    "coverage/**",
    "**/build/**",
    "**/dist/**",
  ]),
  // Rules overrides
  {
    rules: {
      "@next/next/no-page-custom-font": "off",
    },
  },
]);

export default eslintConfig;

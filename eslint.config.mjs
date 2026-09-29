import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    ".vercel/**",
    ".data/**",
    "playwright-report/**",
    "drizzle/**",
    "next-env.d.ts",
    "test-results/**",
  ]),
  { rules: { "react-hooks/set-state-in-effect": "off" } },
]);

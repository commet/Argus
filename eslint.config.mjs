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
    // Claude Code plugins ship their own scripts (not part of the Next app);
    // the app's lint config shouldn't parse them.
    "argus-plugin/**",
    "argus-plugin-v2/**",
    // Generated design-sync artifacts are not part of the app source.
    ".design-sync/**",
    ".ds-sync/**",
    "ds-bundle/**",
    ".shots/**",
  ]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;

import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      // STEP 2 policy: no `any` in application code.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Test files may use vitest globals.
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];

export default config;

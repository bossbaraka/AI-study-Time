import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Use the automatic JSX runtime so test files don't import React explicitly.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/test-env.ts", "./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});

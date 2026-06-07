import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["utils/**/*.test.ts", "helpers/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["utils/**/*.ts", "helpers/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      reporter: ["text", "text-summary", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 21,
        branches: 21,
        functions: 20,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

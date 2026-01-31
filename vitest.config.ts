import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/types/**"],
      thresholds: {
        // Per-file thresholds for tested modules
        "src/utils/fetcher.ts": {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        "src/tools/github.ts": {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        "src/tools/npm.ts": {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        "src/tools/docs.ts": {
          lines: 80,
          functions: 75, // 75% due to internal forEach callback in DOM manipulation
          branches: 80,
          statements: 80,
        },
      },
    },
  },
});

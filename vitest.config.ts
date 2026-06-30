import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/*.spec.ts"],
    setupFiles: ["./tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules",
        ".next",
        "tests/**",
        "src/**/*.test.ts",
        "drizzle/**",
      ],
    },
  },
});

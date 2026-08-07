import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/domain/**/*.ts", "src/runtime/**/*.ts"],
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
});

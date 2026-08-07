import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      include: ["src/domain/**/*.ts", "src/runtime/**/*.ts"],
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
});

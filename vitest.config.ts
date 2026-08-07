import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // better-sqlite3 es un módulo nativo y no sobrevive al pool de workers
    // por defecto: se cierra el canal IPC a mitad de la suite.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      include: ["src/lib/engine.ts", "src/lib/risk.ts", "src/lib/transitions.ts"],
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
});

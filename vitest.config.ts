import { defineConfig } from "vitest/config";

// Standalone config so tests don't load vite.config.ts (which requires INPUT).
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});

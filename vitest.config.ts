import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    // Integration tests need a real Postgres; they skip loudly without
    // TEST_DATABASE_URL rather than passing vacuously.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

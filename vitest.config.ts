import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    // The integration tests share ONE embedded Postgres, and each file
    // truncates the tables in its own `beforeEach`. Two files running at the
    // same time therefore delete each other's rows, and the failures look
    // like nonsense ("expected undefined to be 12.9716"). The files run one
    // after another.
    fileParallelism: false,
    // A real Postgres is booted here and the migrations are applied, so the
    // money-safety invariants are tested against actual database constraints.
    globalSetup: ["tests/setup/global-setup.ts"],
    // Integration tests need a real Postgres; they skip loudly without
    // TEST_DATABASE_URL rather than passing vacuously.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

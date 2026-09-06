import { defineConfig } from "vitest/config";

export const baseConfig = defineConfig({
  test: {
    // Tests never send real email: the log transport keeps an in-memory outbox.
    env: { EMAIL_PROVIDER: "log", STORAGE_DRIVER: "fs" },
    globals: true,
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
  },
});

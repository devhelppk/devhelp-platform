import { baseConfig } from "@repo/vitest-config/base";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    // Fixture exercises carry their own tests; the checker runs those, not vitest here.
    test: { exclude: ["**/node_modules/**", "test/fixtures/**"] },
  }),
);

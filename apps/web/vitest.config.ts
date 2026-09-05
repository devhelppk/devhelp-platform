import { fileURLToPath } from "node:url";
import { uiConfig } from "@repo/vitest-config/ui";
import { defineConfig, mergeConfig } from "vitest/config";

// Mirror the "@/*" path alias from tsconfig.json so tests resolve app modules.
export default mergeConfig(
  uiConfig,
  defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  }),
);

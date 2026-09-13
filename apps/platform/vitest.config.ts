import { uiConfig } from "@repo/vitest-config/ui";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  uiConfig,
  defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  }),
);

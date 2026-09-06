import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    // This package is the env boundary; everything else reads @repo/env.
    rules: { "turbo/no-undeclared-env-vars": "off" },
  },
];

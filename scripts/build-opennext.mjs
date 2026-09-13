#!/usr/bin/env node
/**
 * Build one app with OpenNext for AWS (S22).
 *
 *   NEXT_PUBLIC_LMS_URL=… NEXT_PUBLIC_WEB_URL=… node scripts/build-opennext.mjs lms
 *
 * Produces `apps/<app>/.open-next/`. `sst.config.ts` deploys its
 * `server-functions/default` bundle as a Lambda function behind a function URL;
 * `assets/` holds the static files, which that function does not serve.
 *
 * Build-time environment: only `NEXT_PUBLIC_*` values are inlined into the
 * bundle, so those must be the real public URLs for the stage. Every other
 * value `@repo/env` validates at build gets a placeholder here if unset; the
 * real secrets reach the function at runtime through its Lambda environment,
 * never through the build.
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = process.argv[2];
if (app !== "web" && app !== "lms") {
  console.error("usage: node scripts/build-opennext.mjs <web|lms>");
  process.exit(1);
}
for (const name of ["NEXT_PUBLIC_LMS_URL", "NEXT_PUBLIC_WEB_URL"]) {
  if (!process.env[name]) {
    console.error(`${name} must be set: it is inlined into the client bundle.`);
    process.exit(1);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const placeholders = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://build:build@localhost:5432/build",
  BETTER_AUTH_SECRET: "build-time-placeholder-never-used-at-runtime-0000",
  BETTER_AUTH_URL: process.env.NEXT_PUBLIC_LMS_URL,
  EMAIL_PROVIDER: "log",
  STORAGE_DRIVER: "s3",
  S3_ENDPOINT: "https://build.invalid",
  S3_REGION: "auto",
  S3_BUCKET: "build",
  S3_ACCESS_KEY_ID: "build",
  S3_SECRET_ACCESS_KEY: "build",
};

execSync("pnpm exec open-next build", {
  cwd: join(root, "apps", app),
  stdio: "inherit",
  env: {
    ...placeholders,
    ...process.env,
    // OpenNext installs sharp for its image optimizer with npm. A user-level
    // npm config that sets `allow-scripts` makes that install fail (npm 11
    // rejects it for project-scoped installs), so the build ignores the user
    // config. CI runners have none; this matters on a developer machine.
    NPM_CONFIG_USERCONFIG: "/dev/null",
  },
});
console.log(`[build-opennext] apps/${app}/.open-next ready`);

#!/usr/bin/env node
/**
 * Build the one app (`apps/platform`) with OpenNext for AWS (S22, S23).
 *
 *   NEXT_PUBLIC_SITE_URL=… node scripts/build-opennext.mjs
 *
 * Produces `apps/platform/.open-next/`. `sst.config.ts` deploys its
 * `server-functions/default` bundle as one Lambda function behind a function
 * URL, and `assets/` as the Cloudflare Worker's static assets (the function
 * does not serve them). This script also writes `assets/_headers`, which
 * Workers Static Assets reads to cache `_next/static` for a year.
 *
 * Build-time environment: only `NEXT_PUBLIC_*` values are inlined into the
 * bundle, so `NEXT_PUBLIC_SITE_URL` must be the stage's real public URL
 * (`sst.config.ts` refuses to deploy a bundle built for another host). Every
 * other value `@repo/env` validates at build gets a placeholder here if unset;
 * the real secrets reach the function at runtime through its Lambda
 * environment, never through the build.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = "platform";
for (const name of ["NEXT_PUBLIC_SITE_URL"]) {
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
  BETTER_AUTH_URL: process.env.NEXT_PUBLIC_SITE_URL,
  EMAIL_PROVIDER: "log",
  STORAGE_DRIVER: "s3",
  S3_ENDPOINT: "https://build.invalid",
  S3_REGION: "auto",
  S3_BUCKET: "build",
  S3_ACCESS_KEY_ID: "build",
  S3_SECRET_ACCESS_KEY: "build",
};

// OpenNext runs `next build` inside apps/platform directly, not through
// Turbo, so the workspace packages the app's build depends on (the compiled
// `@repo/vitest-config`, which `vitest.config.ts` type-checks against) are
// missing on a fresh runner. Build the app's dependencies first, app excluded.
execSync("pnpm exec turbo run build --filter='platform^...'", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

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
// Cloudflare Workers Static Assets reads `_headers` from the assets root. Next's
// `_next/static` files are content-hashed, so a browser can keep them for a
// year; without this they are served `max-age=0, must-revalidate` and
// re-checked on every visit.
writeFileSync(
  join(root, "apps", app, ".open-next", "assets", "_headers"),
  "/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n",
);

console.log(`[build-opennext] apps/${app}/.open-next ready`);

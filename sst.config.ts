/// <reference path="./.sst/platform/config.d.ts" />

/**
 * devhelp on AWS (S22).
 *
 * Each Next.js app is one Lambda function running OpenNext's server bundle,
 * reached through a Lambda function URL, in `ap-southeast-1` — the same AWS
 * region as the Neon database, so a query never crosses clouds. Cloudflare sits
 * in front for DNS, TLS and caching, and R2 stays the object store (reached
 * over its S3 API).
 *
 * **No CloudFront, on purpose.** `sst.aws.Nextjs` always creates a CloudFront
 * distribution, and this AWS account cannot create one until AWS Support
 * verifies it (confirmed in the console, 2026-09-13). The founder's constraint
 * for the MVP is minimum cost, and a function URL behind Cloudflare costs
 * nothing extra. Revisit CloudFront (and `sst.aws.Nextjs`) post-launch.
 *
 * Build first, then deploy: `node scripts/build-opennext.mjs <app>` runs
 * OpenNext for AWS, and its `server-functions/default` bundle is uploaded as-is
 * (`bundle`). OpenNext rather than Next's standalone output: standalone keeps
 * pnpm's node_modules as symlinks, which a Lambda zip cannot carry, while
 * OpenNext lays out a self-contained bundle built for Lambda.
 *
 * Stages: `production` is protected and retained on removal; anything else is
 * removed with `sst remove`.
 *
 * Locally SST uses the `devhelp` AWS CLI profile. In GitHub Actions it uses the
 * short-lived credentials of the OIDC role the workflow assumes.
 */
export default $config({
  app(input) {
    const production = input?.stage === "production";
    return {
      name: "devhelp",
      home: "aws",
      removal: production ? "retain" : "remove",
      protect: production,
      providers: {
        aws: {
          region: "ap-southeast-1",
          ...(process.env.GITHUB_ACTIONS ? {} : { profile: "devhelp" }),
        },
      },
    };
  },

  async run() {
    const production = $app.stage === "production";

    // Secret values live in SST secrets (SSM Parameter Store, per stage):
    // `sst secret set <Name> --stage <stage>` with the value on stdin.
    const secret = {
      databaseUrl: new sst.Secret("DatabaseUrl"),
      betterAuthSecret: new sst.Secret("BetterAuthSecret"),
      contentSyncSecret: new sst.Secret("ContentSyncSecret"),
      s3AccessKeyId: new sst.Secret("S3AccessKeyId"),
      s3SecretAccessKey: new sst.Secret("S3SecretAccessKey"),
      // Only production sends real mail; other stages log it.
      resendApiKey: new sst.Secret("ResendApiKey", "unused-outside-production"),
    };

    // Public URLs are inlined into the client bundle at build, so the build
    // and the runtime must agree. Production uses the real domains; another
    // stage passes the URLs it was built with.
    const lmsUrl = production
      ? "https://learn.devhelp.pk"
      : (process.env.NEXT_PUBLIC_LMS_URL ?? "https://example.invalid");
    const webUrl = production
      ? "https://devhelp.pk"
      : (process.env.NEXT_PUBLIC_WEB_URL ?? "https://example.invalid");

    const appEnvironment = {
      NODE_ENV: "production",
      DATABASE_URL: secret.databaseUrl.value,
      // Every concurrent Lambda instance holds its own connections, so keep the
      // per-instance pool small and let Neon's pooler absorb the fan-out.
      DATABASE_POOL_MAX: "2",
      BETTER_AUTH_SECRET: secret.betterAuthSecret.value,
      BETTER_AUTH_URL: lmsUrl,
      CONTENT_SYNC_SECRET: secret.contentSyncSecret.value,
      NEXT_PUBLIC_LMS_URL: lmsUrl,
      NEXT_PUBLIC_WEB_URL: webUrl,
      EMAIL_PROVIDER: production ? "resend" : "log",
      EMAIL_FROM: "devhelp <no-reply@devhelp.pk>",
      RESEND_API_KEY: secret.resendApiKey.value,
      STORAGE_DRIVER: "s3",
      S3_ENDPOINT:
        "https://2bb5ac2be05cf2ad68c88513bc66b734.r2.cloudflarestorage.com",
      S3_REGION: "auto",
      S3_BUCKET: production ? "devhelp" : "devhelp-dev",
      S3_ACCESS_KEY_ID: secret.s3AccessKeyId.value,
      S3_SECRET_ACCESS_KEY: secret.s3SecretAccessKey.value,
      S3_FORCE_PATH_STYLE: "1",
      COMPANY_BANK_WARM_AT: "250",
    };

    const app = (name: string, dir: "lms" | "web", memory: `${number} MB`) =>
      new sst.aws.Function(name, {
        bundle: `apps/${dir}/.open-next/server-functions/default`,
        handler: "index.handler",
        runtime: "nodejs24.x",
        // x86_64 to match the machine that builds the bundle (locally and on
        // the CI runners): OpenNext copies platform binaries for the host.
        architecture: "x86_64",
        memory,
        timeout: "30 seconds",
        // Paired with OpenNext's `aws-lambda-streaming` wrapper.
        streaming: true,
        url: true,
        environment: appEnvironment,
      });

    const lms = app("Lms", "lms", "1536 MB");
    const web = app("Web", "web", "1024 MB");

    return { lms: lms.url, web: web.url };
  },
});

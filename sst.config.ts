/// <reference path="./.sst/platform/config.d.ts" />

/**
 * devhelp on AWS (S22, S23).
 *
 * One app, one function, one Worker. The Next.js app (`apps/platform`) is one
 * Lambda function running OpenNext's server bundle, reached through its
 * function URL, in `ap-southeast-1` — the same AWS region as the Neon database,
 * so a query never crosses clouds. One Cloudflare Worker (`infra/proxy.ts`)
 * sits in front on the site's hostname: it serves the static assets and
 * forwards everything else to the function. R2 stays the object store (reached
 * over its S3 API).
 *
 * **No CloudFront, on purpose.** `sst.aws.Nextjs` always creates a CloudFront
 * distribution, and this AWS account cannot create one until AWS Support
 * verifies it (confirmed in the console, 2026-09-13). The founder's constraint
 * for the MVP is minimum cost, and a function URL behind Cloudflare costs
 * nothing extra. Revisit CloudFront (and `sst.aws.Nextjs`) post-launch.
 *
 * **Origin protection (D9).** The function URL is public (`authorization:
 * "none"`). A per-stage `EdgeKey` secret is given to both the function
 * (`EDGE_KEY`) and the Worker, which sends it as `x-devhelp-edge-key`;
 * `apps/platform/proxy.ts` answers 403 to any request without it.
 *
 * Build first, then deploy: `NEXT_PUBLIC_SITE_URL=… node
 * scripts/build-opennext.mjs` runs OpenNext for AWS, and its
 * `server-functions/default` bundle is uploaded as-is (`bundle`). OpenNext
 * rather than Next's standalone output: standalone keeps pnpm's node_modules as
 * symlinks, which a Lambda zip cannot carry, while OpenNext lays out a
 * self-contained bundle built for Lambda.
 *
 * Stages (D8): exactly `dev` and `production`. `production` is protected and
 * retained on removal; `dev` is removed with `sst remove`.
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
        // Reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_DEFAULT_ACCOUNT_ID from the
        // environment (GitHub secrets in CI; exported from .env.production
        // locally, never committed).
        cloudflare: "6.15.0",
      },
    };
  },

  async run() {
    const production = $app.stage === "production";

    /**
     * The public URL per stage. It is inlined into the client bundle at build,
     * so the build and the runtime must agree; an unknown stage must say which
     * URL it was built for, and a mismatch fails before anything deploys.
     *
     * The certificate for the two-level `dev.learn.devhelp.pk` hostname is
     * unverified until the first dev deploy; if Cloudflare cannot issue it,
     * the fallback is `dev-learn.devhelp.pk`, changed here in `SITE` only.
     */
    const SITE = {
      production: "https://learn.devhelp.pk",
      dev: "https://dev.learn.devhelp.pk",
    } as const;
    const siteUrl =
      SITE[$app.stage as keyof typeof SITE] ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      throw new Error(`stage ${$app.stage}: set NEXT_PUBLIC_SITE_URL`);
    }
    if (
      process.env.NEXT_PUBLIC_SITE_URL &&
      process.env.NEXT_PUBLIC_SITE_URL !== siteUrl
    ) {
      throw new Error("bundle was built for a different host");
    }

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
    // Shared by the function and the Worker; `openssl rand -hex 32` per stage.
    const edgeKey = new sst.Secret("EdgeKey");

    const appEnvironment = {
      NODE_ENV: "production",
      DATABASE_URL: secret.databaseUrl.value,
      // Every concurrent Lambda instance holds its own connections, so keep the
      // per-instance pool small and let Neon's pooler absorb the fan-out.
      DATABASE_POOL_MAX: "2",
      BETTER_AUTH_SECRET: secret.betterAuthSecret.value,
      CONTENT_SYNC_SECRET: secret.contentSyncSecret.value,
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

    const server = new sst.aws.Function("Server", {
      bundle: "apps/platform/.open-next/server-functions/default",
      handler: "index.handler",
      runtime: "nodejs24.x",
      // x86_64 to match the machine that builds the bundle (locally and on the
      // CI runners): OpenNext copies platform binaries for the host.
      architecture: "x86_64",
      memory: "1536 MB",
      timeout: "30 seconds",
      // Paired with OpenNext's `aws-lambda-streaming` wrapper.
      streaming: true,
      url: true,
      environment: {
        ...appEnvironment,
        BETTER_AUTH_URL: siteUrl,
        NEXT_PUBLIC_SITE_URL: siteUrl,
        EDGE_KEY: edgeKey.value,
      },
    });

    // Reaches the Worker as the `SST_RESOURCE_Origin` secret binding (JSON).
    const origin = new sst.Linkable("Origin", {
      properties: { url: server.url, key: edgeKey.value },
    });

    /**
     * The Cloudflare front door (infra/proxy.ts): OpenNext's `assets/` served
     * as Workers Static Assets straight from the edge, and everything else
     * forwarded to the function URL with the edge key.
     *
     * `assets` is marked @internal in SST's Worker types but is implemented —
     * it is what SST's own Cloudflare site components use — so it is used
     * here deliberately; re-check it when upgrading SST.
     *
     * Static asset requests are free and do not count against the Workers
     * free plan's 100,000 requests a day; only page and API requests do.
     *
     * `domain` creates a Workers Custom Domain (DNS record and certificate);
     * `url: false` turns off the Workers subdomain, so the site has one host.
     */
    new sst.cloudflare.Worker("Front", {
      handler: "infra/proxy.ts",
      link: [origin],
      assets: { directory: "apps/platform/.open-next/assets" },
      url: false,
      domain: new URL(siteUrl).hostname,
    });

    // Only the public URL: never print the function URL.
    return { site: siteUrl };
  },
});

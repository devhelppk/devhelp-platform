# Deploying devhelp (S23)

The one-time bootstrap and the per-stage runbook for the deployment shape
built in S22/S23. Values never appear here: no secret, no function URL, no
Workers subdomain. Where a command needs a secret value it reads it from
stdin or from an environment variable the operator exports themselves, never
as a command-line argument (arguments end up in shell history and, on a
shared runner, in logs).

## 1. What exists

```
GitHub Actions (workflow_dispatch)
  → assumes an AWS IAM role over OIDC (no long-lived AWS keys in GitHub)
  → pnpm exec sst deploy --stage <dev|production>
      → one sst.aws.Function ("Server"): the OpenNext bundle for
        apps/platform, running as one Lambda function behind its function
        URL, in ap-southeast-1 (same region as the Neon database)
      → one sst.cloudflare.Worker ("Front"): infra/proxy.ts, serving
        .open-next/assets as Workers Static Assets and forwarding every
        other request to the function, with a Workers Custom Domain on the
        stage's hostname
      → SST's own state (what it deployed last, for diffing) lives in the
        AWS account, not in this repo
      → secrets (DatabaseUrl, BetterAuthSecret, ContentSyncSecret,
        S3AccessKeyId, S3SecretAccessKey, ResendApiKey, EdgeKey) live in SSM
        Parameter Store, one copy per stage, set with `sst secret set`
```

The function URL is never referenced by name anywhere in this document or in
the repo (see `apps/platform/AGENTS.md` / `AGENTS.md` — "never write the
function URL or a Workers subdomain into the repo"). Origin protection (D9):
the Worker sends a per-stage `EdgeKey` as `x-devhelp-edge-key`;
`apps/platform/proxy.ts` answers 403 to anything without it, so the function
URL being technically public does not matter.

Stages are exactly `dev` and `production` (D8). `dev` maps to
`dev.learn.devhelp.pk`; `production` to `learn.devhelp.pk` — see `SITE` in
`sst.config.ts`.

## 2. One-time bootstrap

Status as of 2026-09-13. Steps marked **done** were carried out by the lead
under the `devhelp` AWS profile and the repo's existing Cloudflare/GitHub
access. Steps marked **founder to do** were refused by the lead's tooling as
permission grants (creating an IAM role with `AdministratorAccess`, and the
repo variable that names it) and need the founder's own credentials.

### 2.1 AWS OIDC provider — done, 2026-09-13

The OIDC identity provider that lets GitHub Actions assume an AWS role
without a stored AWS key already exists:

```
arn:aws:iam::099957718323:oidc-provider/token.actions.githubusercontent.com
```

### 2.2 AWS deploy role — done, 2026-09-13

Create the role GitHub Actions assumes, trusted only for this repo's `dev`
and `production` environments (not arbitrary branches or PRs — the trust
condition is scoped to `environment:<stage>`, which GitHub only stamps into
the OIDC token when the job declares `environment:`).

Trust policy (`trust.json`). The repository has GitHub's **immutable
subject claim** switched on (`gh api repos/devhelppk/devhelp-platform/actions/oidc/customization/sub`
→ `use_immutable_subject: true`), so the `sub` GitHub sends is
`repo:devhelppk@216174090/devhelp-platform@1358689704:environment:<stage>`,
with the organisation and repository ids appended; the first production
`deploy.yml` run failed with `Not authorized to perform
sts:AssumeRoleWithWebIdentity` until those forms were added beside the plain
ones:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::099957718323:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:devhelppk/devhelp-platform:environment:dev",
            "repo:devhelppk/devhelp-platform:environment:production",
            "repo:devhelppk@216174090/devhelp-platform@1358689704:environment:dev",
            "repo:devhelppk@216174090/devhelp-platform@1358689704:environment:production"
          ]
        }
      }
    }
  ]
}
```

```sh
aws iam create-role \
  --profile devhelp \
  --role-name devhelp-github-deploy \
  --assume-role-policy-document file://trust.json

# AdministratorAccess for now (SST needs to create/update Lambda, IAM, SSM,
# and read Cloudflare-adjacent state); scope down once the resource set is
# stable.
aws iam attach-role-policy \
  --profile devhelp \
  --role-name devhelp-github-deploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

gh variable set AWS_DEPLOY_ROLE_ARN \
  --body arn:aws:iam::099957718323:role/devhelp-github-deploy
```

### 2.3 Cloudflare CAA records — done, 2026-09-13

Zone `devhelp.pk` (id `0524c11393cc624231a004b0e41d74dc`). A Workers Custom
Domain's certificate can be issued by Google Trust Services or SSL.com as
well as Let's Encrypt, so both were added to the CAA set alongside the
existing record:

| Value                       | Record id                                         |
| --------------------------- | ------------------------------------------------- |
| `0 issue "letsencrypt.org"` | `c4273b0885a865d1f78e0ddbab4ba903` (pre-existing) |
| `0 issue "pki.goog"`        | `acd8aee55e61640c3dbebef50547a548`                |
| `0 issue "ssl.com"`         | `60ec85c0f6ba031d02489e1bcad1fcf9`                |

Rollback (if a Custom Domain's certificate issuance needs to be constrained
again): delete the `pki.goog` and `ssl.com` records by id via the Cloudflare
API or dashboard; the Let's Encrypt record is untouched either way.

### 2.4 GitHub environment `dev` — done, 2026-09-13

```sh
gh api -X PUT repos/devhelppk/devhelp-platform/environments/dev
```

then the unpooled Neon `dev` branch connection string, piped in rather than
typed or interpolated on the command line:

```sh
neon connection-string dev --project-id shiny-wind-39731429 \
  | gh secret set DATABASE_URL_UNPOOLED --env dev
```

The `production` environment already exists from an earlier, abandoned
Workers-based plan, with its own secrets and vars. It is left alone — see
§6 Pruning.

## 3. SST secrets per stage

Seven secret names, set once per stage with the value on stdin (never as a
command argument):

```sh
printf '%s' "$VALUE" | pnpm exec sst secret set <Name> --stage <stage>
```

`printf '%s'` rather than `echo` or a bare `openssl … |` pipe, because SST
stores the trailing newline: the first dev deploy of S23 set `EdgeKey` from
`openssl rand -hex 32 | sst secret set …`, the function held a 65-byte value,
the Worker's `Headers.set` trimmed the newline off the header per the Fetch
spec, and every page answered 403 until the secret was re-set without it.
`apps/platform/proxy.ts` now trims the env value as well, but the other six
secrets are used verbatim, so set them all this way.

Running `sst secret set` (and any local `sst deploy`) needs the Cloudflare
provider's credentials exported, and, if you also run
`build-opennext.mjs` locally, a neutralised npm user config (the OpenNext
image-optimizer install fails under some npm 11 configs otherwise):

```sh
export CLOUDFLARE_API_TOKEN=…
export CLOUDFLARE_DEFAULT_ACCOUNT_ID=…
export NPM_CONFIG_USERCONFIG=/dev/null
```

| Name                | What                                                                                                                                        | Per-stage value                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `DatabaseUrl`       | Pooled Neon connection string                                                                                                               | `dev` → Neon `dev` branch, pooled; `production` → Neon `production` branch, pooled |
| `BetterAuthSecret`  | Better Auth session secret (`openssl rand -base64 32`)                                                                                      | distinct per stage                                                                 |
| `ContentSyncSecret` | Bearer for `POST /api/content/sync`                                                                                                         | distinct per stage                                                                 |
| `S3AccessKeyId`     | R2 access key                                                                                                                               | scoped to the stage's bucket                                                       |
| `S3SecretAccessKey` | R2 secret key                                                                                                                               | scoped to the stage's bucket                                                       |
| `ResendApiKey`      | Resend API key — **production only**; `dev` keeps SST's default ("unused-outside-production") because `dev` logs mail instead of sending it | production                                                                         |
| `EdgeKey`           | Shared secret between the Worker and the function (`openssl rand -hex 32`)                                                                  | distinct per stage                                                                 |

R2 bucket per stage: `dev` → `devhelp-dev`; `production` → `devhelp` (see
`S3_BUCKET` in `sst.config.ts`).

Status (2026-09-13): `dev` and `production` — all seven set, production's
from `.env.production` over stdin.

## 4. Deploying

Via the workflow (preferred — this is what CI/CD means here, dispatched
deliberately):

```sh
gh workflow run deploy.yml -f stage=dev
```

The equivalent done locally (for debugging a deploy, not the normal path):

```sh
export CLOUDFLARE_API_TOKEN=…
export CLOUDFLARE_DEFAULT_ACCOUNT_ID=…
export AWS_PROFILE=devhelp
NEXT_PUBLIC_SITE_URL=https://dev.learn.devhelp.pk NPM_CONFIG_USERCONFIG=/dev/null \
  node scripts/build-opennext.mjs
pnpm exec sst deploy --stage dev
```

### Verification (plan §6 C)

- `https://dev.learn.devhelp.pk/` returns 200.
- The `Set-Cookie` header on the auth cookie carries no `Domain=` attribute
  (one host now; `crossSubDomainCookies` was removed in Phase A).
- Request a `_next/static/...` asset twice; the second response carries
  `cf-cache-status: HIT`.
- The function URL answers 403 without the edge key, checked without ever
  printing the URL itself:

  ```sh
  fn_name="$(aws lambda list-functions --profile devhelp \
    --query "Functions[?starts_with(FunctionName, 'devhelp-dev-Server')].FunctionName" \
    --output text)"
  fn_url="$(aws lambda get-function-url-config --profile devhelp \
    --function-name "$fn_name" --query FunctionUrl --output text)"
  curl -s -o /dev/null -w '%{http_code}\n' "$fn_url"   # expect 403; $fn_url is never echoed elsewhere
  ```

- A certificate PDF downloads and renders.
- Sign-up sends a verification email: `dev` logs it (Mailpit-style outbox is
  not running in the deployed stage — check the function's logs), production
  sends through Resend.
- `POST /api/content/sync` with the `ContentSyncSecret` bearer succeeds.

### Dev verification record, 2026-09-13

Deployed locally (`build-opennext.mjs` + `sst deploy --stage dev`, not yet
through `deploy.yml`, which still needs the IAM role). The Workers Custom
Domain issued a Google Trust Services certificate whose SANs include
`dev.learn.devhelp.pk`, so the two-level hostname works and the
`dev-learn` fallback was not needed. Results:

- `/`, `/about`, `/faq`, `/courses`, a lesson, `/companies`,
  `/companies/arbisoft`, `/sitemap.xml`, `/robots.txt`, `/design` → 200;
  `/home` → 307 to `/sign-in?callbackURL=/home`; an unknown path → 404.
- Sitemap lists `/about` and the lessons and not `/home`; robots disallows
  `/home` and `/design`.
- A `_next/static` chunk: `cache-control: public, max-age=31536000,
immutable`, `cf-cache-status: MISS` then `HIT`.
- Sign-up over `/api/auth/sign-up/email` → 200 with
  `__Secure-better-auth.session_token … Path=/; HttpOnly; Secure; SameSite=Lax`
  and no `Domain=` attribute.
- The function URL: 403 with no key or a wrong key, 200 with the stage's
  key (the URL was read into a shell variable and never printed).
  `.sst/outputs.json` carries only `site`.
- **Not working on `dev`, by earlier design rather than by this change:**
  the verification email fails with `EMAIL_PROVIDER must be resend or smtp
in production` because `dev` deliberately runs `EMAIL_PROVIDER=log` and
  `@repo/email` refuses `log` under `NODE_ENV=production` (sign-up itself
  succeeds; verification never blocks sign-in). Founder decision: give `dev`
  a Resend key, or let `@repo/email` accept `log` on a non-production stage.
- **Not working on Lambda:** `POST /api/content/sync` with the bearer
  answers 409 `repo root not available in this deployment`, because the
  bundle carries no `.content/` checkout. `migrate.yml` with
  `sync_content=true` is the working path; the route stays a local recovery
  tool.
- Not verified: a certificate PDF (needs a completed course on the `dev`
  database).

## 5. Production cutover (founder go-ahead required)

Do not run any step in this section without the founder's explicit go-ahead
at the time — this is not a decision that was pre-authorized when the plan
was written.

1. Set the seven production SST secrets (§3); `ResendApiKey` is required
   here, unlike `dev`.
2. `gh workflow run migrate.yml -f stage=production` (add
   `-f sync_content=true` if the content pipeline needs a fresh sync at the
   same time).
3. `gh workflow run deploy.yml -f stage=production`.
4. Browse `https://learn.devhelp.pk`: sign up and receive the verification
   email through Resend, work through a lesson, download a certificate PDF
   (confirms R2 bucket `devhelp`), open a company page, fetch `/sitemap.xml`.

### D1: `devhelp.pk` stays separate (founder, 2026-09-13)

There is no redirect from the apex or `www` to `learn.devhelp.pk`.
`devhelp.pk` will get its own website later; devhelp Learn is one product
under the devhelp.pk brand, on its own hostname. The apex and `www` `A`
records, `start`, `storage`, the mail records and `ledgery` are untouched by
this deployment, and the only zone changes S23 made are the two CAA records
(§2.3) and the Workers Custom Domains for `dev.learn` and `learn`.

### Two-level-hostname fallback

If Cloudflare cannot issue a certificate for the two-level `dev.learn.devhelp.pk`
hostname (tested on `dev` before production, per plan §5 risks), the fallback
is the one-level `dev-learn.devhelp.pk`, changed in exactly one place: the
`SITE` map in `sst.config.ts`. Nothing else in the repo encodes the hostname.

### Rollback

- **Bad release:** redeploy the previous commit —
  `git checkout <previous-sha>` (or a tag), rebuild, `gh workflow run
deploy.yml -f stage=production` — SST diffs against its existing state, so
  this is a normal deploy, not a special recovery path.
- **Abandon the Custom Domain entirely:** delete the Workers Custom Domain
  for `learn.devhelp.pk`; the hostname falls back to the zone's `*.devhelp.pk`
  wildcard record, which still points at the Hetzner box.

### Production record, 2026-09-13

Landed through the workflows, with the founder's go-ahead: `migrate.yml
production` (`sync_content=true`, run 34761442287) laid the schema down on
the empty Neon `production` branch and synced the content; `pnpm
db:reference` was run locally against the unpooled URL for the 13 cities and
14 job roles; `deploy.yml production` (run 34762335684) built, assumed the
OIDC role and deployed — after two fixes on the way: the build script now
builds the app's workspace dependencies first, and the role trusts GitHub's
immutable subject claim. Verified: `/`, `/about`, `/faq`, `/courses`,
`/companies`, `/sitemap.xml`, `/robots.txt`, `/design` → 200; `/home` → 307;
the certificate is the zone's `*.devhelp.pk` one; a `_next/static` chunk goes
`MISS` → `HIT`; sign-up sets `__Secure-better-auth.session_token` with no
`Domain=`; the production function URL answers 403 without the key.

Open, and not a deploy matter: both synced courses are `needs_metadata` and
unpublished, so no lesson URL answers until the studio describes and
publishes them — the smoke test checks `/courses` rather than a lesson for
that reason — and production has no admin account yet (`pnpm dev:admin`
refuses `NODE_ENV=production`; the first admin needs a sign-up plus a manual
`role = 'admin'` update on the `users` row).

## 6. Pruning

Decided 2026-09-13 after the production deploy was verified (founder: keep
only what the workflows use), **not yet executed** — the lead's tooling
refuses secret-store deletions, so the founder runs these. Keep: repo secret
`CLOUDFLARE_API_TOKEN`; repo variables `AWS_DEPLOY_ROLE_ARN`,
`CLOUDFLARE_ACCOUNT_ID`; environment secret `DATABASE_URL_UNPOOLED` on `dev`
and `production`. Delete (everything below now lives in SST secrets or
`sst.config.ts`, or is unused by any workflow):

```sh
for s in BETTER_AUTH_SECRET CONTENT_SYNC_SECRET DATABASE_URL RESEND_API_KEY \
         S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
  gh secret delete "$s" --env production
done
for v in BETTER_AUTH_URL COMPANY_BANK_WARM_AT DATABASE_POOL_MAX EMAIL_FROM \
         EMAIL_PROVIDER NEXT_PUBLIC_LMS_URL NEXT_PUBLIC_WEB_URL S3_BUCKET \
         S3_ENDPOINT S3_FORCE_PATH_STYLE S3_REGION STORAGE_DRIVER; do
  gh variable delete "$v" --env production
done
gh secret delete NEON_API_KEY
gh variable delete CLOUDFLARE_ZONE_ID
gh variable delete NEON_PROJECT_ID
```

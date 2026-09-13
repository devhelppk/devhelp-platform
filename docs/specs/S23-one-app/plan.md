# S23. One app, a real front door, one deployment

Status: planned (plan produced 2026-09-13; founder decisions below taken at the
recommended values unless marked otherwise).

## 0. Context (verified against the tree, branch `deploy/cloudflare`, HEAD `c0a87fe` + uncommitted `infra/proxy.ts`, Worker section of `sst.config.ts`, `_headers` in `scripts/build-opennext.mjs`, `crossSubDomainCookies` fix in `packages/auth/src/server.ts`)

- **Two apps, one design system.** `apps/web` (port 3000, 17 source files, deps a strict subset of `apps/lms`'s) and `apps/lms` (port 3001). Both root layouts have the same shape (Geist + Literata, `ThemeProvider`); web adds `TooltipProvider` + `Toaster` globally, lms uses `DeferredToaster`. `apps/web/lib/og.tsx` and `apps/lms/lib/og.tsx` are identical.
- **The `/` collision.** `apps/lms/app/page.tsx` is `force-dynamic`, calls `learning.myEnrollments()`, and on `UNAUTHORIZED` renders an inline signed-out hero — a second, weaker landing. `apps/web/app/page.tsx` is the S21 landing (reads Postgres via `lib/curriculum.ts`, which filters `needs_metadata = false`; `catalogue.listCourses` does **not**, so `curriculum.ts` must survive the merge).
- **Shell.** `apps/lms/components/shell/shell.tsx` picks `Page`/`SiteHeader` (signed out) vs `ToolsShell` (signed in) via `shellSession()`. The lms `SiteHeader` has Courses / Companies / Search / theme / bell / `AccountMenu`; the web `SiteHeader` has About / Roadmap / Contribute / FAQ / theme / "Start learning" and the only `SiteFooter`. The lesson reader builds its own `Sidebar` header and does not use `Shell`.
- **Cross-app links.** 34 files reference `NEXT_PUBLIC_WEB_URL` / `NEXT_PUBLIC_LMS_URL`, incl. `packages/env/src/{schema,client,server,schema.test}.ts`, `packages/auth/src/server.ts` (`trustedOrigins`, `crossSubDomainCookies`, invitation URL), `packages/api/src/routers/{moderation,comments}.ts`, `packages/learning/src/certificate-email.ts`, `turbo.json`, `.env.example`, `.github/workflows/ci.yml`, `sst.config.ts`, `scripts/build-opennext.mjs`. Web links to the LMS with raw `<a href={`${LMS}/…`}>`; after the merge these become `next/link`.
- **Dashboard links to `/`**: `not-found.tsx`, `verify/[uuid]/page.tsx:68`, lesson header `BrandLogo`, `account-menu.tsx` ("Dashboard" + sign-out `redirect("/")`), `tools-shell.tsx` (logo + sign-out), `auth-page.tsx`, `small-page.tsx`; `safePath` fallback `"/"` in `lib/safe-path.ts` drives the post-sign-in default via `safeCallback`.
- **Sitemap/robots/OG/JSON-LD**: lms `sitemap.ts` (DB-backed) and web `sitemap.ts` (8 statics); two `robots.ts`; web-only `app/opengraph-image.tsx`; `components/structured-data.tsx` (Organization + WebSite + second-host `EducationalOrganization`) and lms `course-structured-data.tsx`.
- **Bundle budget**: `scripts/check-bundle-budget.ts` defaults `BUDGET_URL` to `:3001`; CI starts `next start --port 3001` from `apps/lms`.
- **Deployment today.** `sst.config.ts`: two `sst.aws.Function`s + two `sst.cloudflare.Worker`s (`infra/proxy.ts`, `ORIGIN_URL` = function URL, `assets`). SST Worker `environment` entries are `plain_text` bindings; linked resources are `secret_text` bindings named `SST_RESOURCE_<Name>` (`.sst/platform/src/components/cloudflare/worker.ts`). A Worker `domain` creates a `cloudflare.WorkersCustomDomain` (auto DNS + cert; hostname must not already have a record). `sst.aws.Function` link grants only `lambda:InvokeFunction`, not `InvokeFunctionUrl`. `.sst/outputs.json` prints raw `lambda-url` origins — remove.
- **Cloudflare zone `devhelp.pk` (id `0524c11393cc624231a004b0e41d74dc`), recorded 2026-09-13:** `A devhelp.pk 135.181.29.181 proxied`, `A www 135.181.29.181 proxied`, `A *.devhelp.pk 135.181.29.181 proxied`, `CAA devhelp.pk 0 issue "letsencrypt.org"`, `CNAME start → 4232e47d84f94d92.vercel-dns-017.com (DNS only)`, `CNAME storage → public.r2.dev proxied`, Zoho MX ×3, SPF, `zmail._domainkey`, Resend `send.` MX/SPF + `resend._domainkey`, `_vercel` TXT, Google site-verification TXT, `AAAA ledgery 100:: proxied` (other project). **No record exists for `learn` or `dev.learn`.**
- **AWS**: account `099957718323`, profile `devhelp`; no OIDC provider yet. CloudFront blocked; Lambda concurrency 10.
- **GitHub**: repo secrets `CLOUDFLARE_API_TOKEN`, `NEON_API_KEY`; repo vars `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`, `NEON_PROJECT_ID`; environment `production` with secrets and vars from the abandoned Workers plan. No `dev` environment. Only workflow: `ci.yml`.
- **Spec bookkeeping gap**: `docs/spec.md` stops at S20; S21 (`076316d`) and S22 (`c0a87fe`) have no tracker entries. Add retro entries with S23.
- **Next 16**: `middleware.ts` is deprecated → `proxy.ts`. Route groups share the root layout; conflicting paths across groups error at build.

## 1. Founder decisions

| #   | Decision                                        | Taken                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `devhelp.pk` apex and `www` after consolidation | **Changed 2026-09-13 (founder):** keep `devhelp.pk` and `learn.devhelp.pk` separate. `devhelp.pk` gets its own website later; devhelp Learn is one product under the devhelp.pk brand. No redirect rule; the apex, `www` and every other record stay as they are. |
| D2  | `/design` public?                               | Yes, `noindex` + robots disallow.                                                                                                                                                                                                                                 |
| D3  | Signed-in dashboard route                       | `/home`; signed-in visitor to `/` is redirected to `/home`.                                                                                                                                                                                                       |
| D4  | App directory/package                           | `git mv apps/lms apps/platform`, package `platform`, port 3000.                                                                                                                                                                                                   |
| D5  | Header on the four Markdown doc pages           | Signed-out variant (`SiteHeader static`), pages stay `force-static`.                                                                                                                                                                                              |
| D6  | Wordmark                                        | Drop `product="Learn"` everywhere.                                                                                                                                                                                                                                |
| D7  | Packaging                                       | One spec S23, three commits (A merge, B redesign, C deploy) + retro S21/S22 entries.                                                                                                                                                                              |
| D8  | Stages                                          | Exactly `dev` and `production`.                                                                                                                                                                                                                                   |
| D9  | Origin protection                               | Keep `url: true`; shared `EDGE_KEY` header checked by Next `proxy.ts` (403 otherwise).                                                                                                                                                                            |
| D10 | Madder in the hero trace figure                 | One deliberate use on the failing line; record the amendment in DESIGN.md.                                                                                                                                                                                        |

## 2. Phase A — merge into one app (commit 1)

### A1. Rename

- `git mv apps/lms apps/platform`; package name `platform`; `dev`/`start` on port 3000.
- Sweep `lms` references: root `package.json` scripts (`dev:web*`, `dev:lms*` → `dev`, `dev:clean`), `.github/workflows/ci.yml` (`cd apps/platform`, port 3000, `BETTER_AUTH_URL=http://localhost:3000`), `sst.config.ts`, `scripts/build-opennext.mjs` (single app, no argv), `scripts/check-bundle-budget.ts` (default `http://localhost:3000`), `AGENTS.md` (Layout, Ports, `dev:clean`, route handlers, "Keep the LMS root layout thin"), `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `console.error("[lms] …")` in `sitemap.ts`. `.env.example`: `BETTER_AUTH_URL="http://localhost:3000"`. Note that local `.env` must be edited.

### A2. Env collapse (`@repo/env`)

- `packages/env/src/schema.ts`: one `NEXT_PUBLIC_SITE_URL` replaces both client keys (default `http://localhost:3000` outside production). Update `client.ts`, `server.ts` `runtimeEnv`, `schema.test.ts`.
- `turbo.json` `globalEnv`: remove both old names, add `NEXT_PUBLIC_SITE_URL`, `EDGE_KEY`. `.env.example`: `NEXT_PUBLIC_SITE_URL="http://localhost:3000"` and a commented `EDGE_KEY`.
- Consumers: `packages/auth/src/server.ts` → `trustedOrigins: [env.NEXT_PUBLIC_SITE_URL]`, invitation URL, **delete `crossSubDomainCookies`** (one host). `packages/api/src/routers/moderation.ts`, `comments.ts`, `packages/learning/src/certificate-email.ts`, every app file → `NEXT_PUBLIC_SITE_URL`. `next.config.ts` `env` block → one key.
- Local `.env.production` (gitignored): `NEXT_PUBLIC_SITE_URL=https://learn.devhelp.pk`.

### A3. Route groups and pages

```
apps/platform/app/
  layout.tsx                      root: merged metadata; thin (no global TooltipProvider/Toaster)
  (marketing)/layout.tsx          SiteHeader + children + SiteFooter
  (marketing)/page.tsx            landing (from apps/web); signed in → redirect("/home")
  (marketing)/about|contribute|faq|roadmap|privacy|terms|policy|design/…
  (marketing)/opengraph-image.tsx
  (platform)/home/page.tsx        dashboard (from apps/lms/app/page.tsx); signed out → redirect("/sign-in?callbackURL=/home")
  (platform)/…                    every other existing lms route, unchanged paths
  sitemap.ts, robots.ts, icon.svg, not-found.tsx, error.tsx, api/…   at app root
```

- Landing: drop `revalidate`; read `shellSession()`; `if (session) redirect("/home")`; `${LMS}` anchors → `next/link`. Move `apps/web/lib/curriculum.ts` → `apps/platform/lib/curriculum.ts` unchanged.
- Doc pages: move with `MarkdownDoc`; `markdown-doc.tsx` + test → `apps/platform/lib/`.
- `/design`: move `page.tsx`, `demos.tsx`, `shell-demo.tsx`; `robots: { index: false }`.
- `lib/safe-path.ts` fallback → `"/home"`; update `safeCallback` tests. Sign-out keeps `redirect("/")`. Dashboard links → `/home` (`not-found.tsx`, `account-menu.tsx`, `verify/[uuid]` if it links home, `tools-shell.tsx` logo); marketing `site-header` logo and lesson header logo → `/`.

### A4. Shell unification (`components/shell/`)

- One `SiteHeader` (signed-out chrome, used by `Page` and the marketing layout): logo → `/`; Courses, Companies, About (`hidden sm:inline-flex`), Search icon, `ThemeToggle` (`hidden sm:block`), `NotificationBell`, `AccountMenu`; when signed out: outline "Sign in" + primary "Start learning" → `/courses` (only the primary below `sm`). `static?: boolean` prop renders the signed-out variant without `headers()`.
- `SiteFooter` → `components/shell/site-footer.tsx`, all `next/link`; columns Learn (Courses, Companies, Search), Project (About, Roadmap, Contribute, FAQ, GitHub), Legal (Content policy, Privacy, Terms, `policy@devhelp.pk`). Rendered by the marketing layout and `Page`, not `ToolsShell`.
- Delete `apps/web/components/site-header.tsx`. Remove `product="Learn"` from `site-header.tsx`, `tools-shell.tsx`, `auth-page.tsx`, `small-page.tsx`, lesson page. `structured-data.tsx` → `components/marketing/structured-data.tsx`, Organization + WebSite only; `course-structured-data.tsx` provider url → site URL.
- `(marketing)` pages pull no tRPC provider or client island except `ThemeToggle` and the FAQ `Accordion`.

### A5. Sitemap / robots / OG

- One `sitemap.ts`: lms entries + marketing statics (`/`, `/about`, `/roadmap`, `/contribute`, `/faq`, `/policy`, `/privacy`, `/terms`); not `/home`. One `robots.ts`: union of disallows + `/home` + `/design`. Delete `apps/web/lib/og.tsx`; `opengraph-image.tsx` into `(marketing)`. Root metadata: web's title default, template `%s · devhelp`, `siteName: "devhelp"`.

### A6. Delete `apps/web`, fix the tool chain

- `git rm -r apps/web`; `pnpm install`.
- `check-bundle-budget.ts`: keep `/`, add `/about`; port 3000. `ci.yml`: `apps/platform`, `:3000`.
- Tests: moved `markdown-doc.test.tsx`, `safeCallback` → `/home`, `schema.test.ts`; add `apps/platform/test/marketing.test.tsx` asserting every `SiteFooter` internal link is a `next/link` href starting with `/`.
- `docs/spec.md`: retro S21 (`076316d`) and S22 (`c0a87fe`) entries; S23 `in-progress` → this plan. `AGENTS.md`: Layout (one `apps/platform` row), Ports, shell paragraph (`/` landing, `/home` dashboard, `(marketing)` vs `Shell`), env (`NEXT_PUBLIC_SITE_URL`), drop cross-subdomain wording. `DESIGN.md`: `/design` lives in `apps/platform`.
- Gate: `pnpm format && pnpm lint && pnpm check-types && pnpm test && pnpm build`, then `pnpm check-budget` against `next start --port 3000`.

## 3. Phase B — redesign the public pages (commit 2; browser loop mandatory)

Scope: `/`, `/about`, `/contribute`, `/faq` redesigned; `/roadmap`, `/policy`, `/privacy`, `/terms` stay document-style. All server-rendered; no new client JS on `/`. Within DESIGN.md except D10.

### B1. Marketing vocabulary (`components/marketing/`)

- `section.tsx`: `<Section tone="paper"|"mist">` full-bleed `border-t` (+ `bg-muted/30` for mist), inner `mx-auto max-w-6xl px-4 sm:px-6 py-16 md:py-24`. Alternate tones; never two mist adjacent.
- `section-heading.tsx`: `h2` `font-display text-3xl font-semibold tracking-tight text-balance max-w-2xl`, optional lead `text-lg text-muted-foreground text-pretty max-w-prose`. No eyebrows, no icons.
- `frame.tsx`: product frame — `rounded-lg border bg-card overflow-hidden`, 32px title bar (`bg-muted/40 border-b`, three 8px `rounded-sm bg-border` squares, muted `text-xs` path label like `learn.devhelp.pk/courses/…`), `aria-hidden`, `pointer-events-none select-none`; static JSX `text-sm`, `aspect-[4/3]` mobile, `aspect-[16/10]` from `md`. Built from real UI primitives (`Badge`, `Card`, `Table`; a plain div instead of the client `Progress`).
- `trace-figure.tsx` (hero device): Geist Mono `text-xs sm:text-sm`, lines ≤34 characters (fits 390px), ~12 lines of a webhook handler that charges twice (no idempotency key). Three numbered gutter markers (`size-5 rounded-sm bg-primary text-primary-foreground text-xs font-medium`): 1 symptom ("customer charged twice" comment), 2 the retry line traced back through, 3 the cause. Cause line `border-l-2 border-madder-600 dark:border-madder-300 bg-madder-50/60 dark:bg-madder-950/40` (D10). Below: `ol` of three `li`s — "Start at the symptom", "Follow the data backwards", "Prove the fix with a test". Panel `bg-muted/40 border`; comments `text-muted-foreground`; keywords `text-brand-700 dark:text-brand-300`; strings `text-foreground`. Hard-coded spans, no runtime highlighter. Visually-hidden caption describing the three steps.
- `reader-frame.tsx`: lesson reader in miniature — rail of lessons (Welcome, How agents work, Trace the refund, Foundations check) with a current item (2px `bg-primary` left rule), prose column with a Literata `h1` "Trace the refund" and two body lines, right "On this page" list.
- `bank-frame.tsx`: company bank — facts row (monogram square, city, "hires juniors"), pay table with three roles and withheld cells ("fewer than five reports"), one review card with **new synthetic text written in this file** (never real rows).

### B2. Landing `/` (left-aligned, `max-w-6xl`)

1. **Hero** (`py-16 md:py-24`, `lg:grid-cols-12 gap-10`): left `lg:col-span-7` — `h1` Literata `text-5xl sm:text-6xl font-medium tracking-tight text-balance max-w-[18ch]` "The missing semester between your degree and your first engineering job."; lead `text-lg sm:text-xl text-muted-foreground max-w-prose text-pretty` (current copy, two sentences); CTAs primary `size="lg"` "Start the first lesson" → `/courses/ai-engineering-foundations/welcome`, outline "See the courses" → `/courses`; `text-sm text-muted-foreground` "Read any lesson without an account. Sign in when you want your progress kept." Right `lg:col-span-5` — `TraceFigure` (after CTAs below `lg`).
2. **How a lesson works** (mist): heading "Most courses teach you to build something that already works. This one starts with something that is broken." Five-step strip (`grid md:grid-cols-5 divide-y md:divide-y-0 md:divide-x`), each: "Step N" `text-sm text-muted-foreground`, `h3` `text-xl font-display`, two body lines. Steps: Understand, Reproduce, Trace, Fix and test, Explain (Failure / Pattern / Trade-off / Trigger). No icons.
3. **The method** (paper): `lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`; left `ReaderFrame`; right the three METHOD items as a `dl` (`dt` `font-display text-xl`, `dd` muted, `border-t` rules). No icons.
4. **What you can learn today** (mist): published courses as link-only bordered cards, hidden when empty; plus "Being written now, in the open" listing the launch set by name (core engineering, data structures, databases, the engineering flagship, agentic AI) with a link to `/roadmap`. No counts.
5. **The company bank** (paper): `lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]`; left current copy + primary "Look up a company" → `/companies`; right `BankFrame`; below the frame the three facts (Give to get / Anonymous / Pay you cannot be identified by) as a compact `dl text-sm`.
6. **Who it is for** (mist): `md:grid-cols-3`, `h3` "The final-year student" / "The fresh graduate" / "Two years in" (copy from `/about`).
7. **Free, and open all the way down** (paper): current copy; repo cards keep 16px `BookOpen`/`Wrench` inline with the repo name; closing line "runs on a laptop with Docker and no paid keys".
8. **Closing CTA** (mist): heading + hero CTAs; then `SiteFooter`.

- Only DESIGN.md type steps; the hero is the only `text-6xl`. `transition-colors` on hover only; no entrance animation. Tokens and `brand-*`/`madder-*` pairs only. Strict h1 → h2 → h3; buttons name outcomes. 390px: single column, no horizontal scroll (`scrollWidth === innerWidth`).

### B3. `/about`, `/contribute`, `/faq`

- All open with `PageHeader`: About "Why this exists", action "Start the first lesson"; Contribute "Contribute", action "Open the content repo" (external); FAQ "Questions people ask".
- About: keep copy; `max-w-4xl`; intro two-column at `lg` (lead left, `ReaderFrame` right); "What we think teaching should look like" as a numbered `ol` with `font-display` lead-ins; company bank section reuses `BankFrame` at `md:grid-cols-2`.
- Contribute: `Door` cards stay; Mentor and Company bank sections two-up on `lg`; all links `next/link`.
- FAQ: `Accordion`; three `h2` groups (Learning, The company bank, The project); `max-w-3xl`.
- Copy: S21 voice (plain, declarative, sentence case, no arrows); every sentence true today or "being written"; no numbers on the landing; British spelling.

### B4. Browser loop (`docs/specs/S23-one-app/test.md`, `screenshots/`)

Routes `/`, `/about`, `/contribute`, `/faq`, `/roadmap`, `/policy`, `/privacy`, `/terms`, `/design`, `/home` (signed in), `/courses`, `/companies`, a lesson. States: signed out, signed in (learner, admin), empty catalogue. 1440 and 390; light and dark; console clean; no horizontal scroll; two rounds with what each changed. `pnpm check-budget` on `/` and `/about`.

## 4. Phase C — one deployment (commit 3)

### C1. `sst.config.ts`

```ts
const SITE = {
  production: "https://learn.devhelp.pk",
  dev: "https://dev.learn.devhelp.pk",
} as const;
const siteUrl =
  SITE[$app.stage as keyof typeof SITE] ?? process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error(`stage ${$app.stage}: set NEXT_PUBLIC_SITE_URL`);
if (
  process.env.NEXT_PUBLIC_SITE_URL &&
  process.env.NEXT_PUBLIC_SITE_URL !== siteUrl
)
  throw new Error("bundle was built for a different host");
const edgeKey = new sst.Secret("EdgeKey");
const server = new sst.aws.Function("Server", {
  bundle: "apps/platform/.open-next/server-functions/default",
  handler: "index.handler",
  runtime: "nodejs24.x",
  architecture: "x86_64",
  memory: "1536 MB",
  timeout: "30 seconds",
  streaming: true,
  url: true,
  environment: {
    ...appEnvironment,
    BETTER_AUTH_URL: siteUrl,
    NEXT_PUBLIC_SITE_URL: siteUrl,
    EDGE_KEY: edgeKey.value,
  },
});
const origin = new sst.Linkable("Origin", {
  properties: { url: server.url, key: edgeKey.value },
});
new sst.cloudflare.Worker("Front", {
  handler: "infra/proxy.ts",
  link: [origin],
  assets: { directory: "apps/platform/.open-next/assets" },
  url: false,
  domain: new URL(siteUrl).hostname,
});
return { site: siteUrl };
```

- `appEnvironment` as today minus the old `NEXT_PUBLIC_*` keys (`S3_BUCKET` `devhelp` / `devhelp-dev`, `EMAIL_PROVIDER` resend/log, `DATABASE_POOL_MAX: "2"`). `DatabaseUrl` per stage → Neon `production` / `dev` (pooled).
- `infra/proxy.ts`: read `env.SST_RESOURCE_Origin` (secret_text JSON `{ url, key }`, parsed once with a type guard, no `sst` SDK import), set `x-devhelp-edge-key`, keep host/`x-forwarded-*`/`redirect: "manual"`. No `lambda-url`/`workers.dev` strings anywhere in the repo.
- `apps/platform/proxy.ts` (Next 16): if `EDGE_KEY` is set and the header does not match → 403; matcher excludes `_next/static`, `_next/image`, `icon.svg`. `EDGE_KEY` in `serverSchema` as `optionalString`.
- `scripts/build-opennext.mjs`: single app; requires `NEXT_PUBLIC_SITE_URL`.

### C2. One-time bootstrap (profile `devhelp`; record in `docs/specs/S23-one-app/deploy.md`)

1. GitHub OIDC provider + role `devhelp-github-deploy` trusted for `repo:devhelppk/devhelp-platform:environment:dev` and `:environment:production` (`aud sts.amazonaws.com`), `AdministratorAccess` for now (scope down later). Repo variable `AWS_DEPLOY_ROLE_ARN`.
2. Cloudflare CAA: add `0 issue "pki.goog"` and `0 issue "ssl.com"` beside Let's Encrypt; record ids for rollback.
3. SST secrets per stage: `DatabaseUrl`, `BetterAuthSecret`, `ContentSyncSecret`, `S3AccessKeyId`, `S3SecretAccessKey`, `ResendApiKey` (production), `EdgeKey` (`openssl rand -hex 32`, per stage).
4. GitHub environment `dev` with secret `DATABASE_URL_UNPOOLED` (Neon `dev`). Prune abandoned `production` env vars/secrets **only after** the first production deploy is verified.

### C3. Workflows (`workflow_dispatch` only, `blacksmith-4vcpu-ubuntu-2404`)

- `deploy.yml`: input `stage` (`dev|production`), `environment: ${{ inputs.stage }}`, `id-token: write`. Checkout → pnpm/node → `pnpm install --frozen-lockfile` → `pnpm content:pull` → `NEXT_PUBLIC_SITE_URL` from the stage → `node scripts/build-opennext.mjs` → `aws-actions/configure-aws-credentials` (`vars.AWS_DEPLOY_ROLE_ARN`, `ap-southeast-1`) → `pnpm exec sst deploy --stage …` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_DEFAULT_ACCOUNT_ID` → smoke `curl` (`/`, `/sitemap.xml`, `/robots.txt`, a lesson, a `_next/static` asset). Concurrency per stage; never print outputs beyond `site`.
- `migrate.yml`: input `stage`; `DATABASE_URL: ${{ secrets.DATABASE_URL_UNPOOLED }}` → `pnpm db:migrate`; optional `sync_content` → `content:pull && content:sync`.
- `ci.yml`: Phase A edits; optional grep step failing on `lambda-url|workers\.dev`.

### C4. Cutover and rollback

1. Deploy `dev` first; verify the Workers Custom Domain issues a certificate for the two-level `dev.learn.devhelp.pk` (fallback `dev-learn.devhelp.pk`, changed in the host map only).
2. **Production (founder go-ahead required):** `migrate.yml production` → `deploy.yml production` → browse `https://learn.devhelp.pk`: sign-up + Resend email, a lesson, certificate PDF (R2 `devhelp`), company page, sitemap.
3. **D1 redirect (founder go-ahead required):** Single Redirect rule apex/`www` → `https://learn.devhelp.pk${uri}` (301). Hetzner records, `start`, `storage`, mail, `ledgery` untouched. Rollback: disable the rule; redeploy the previous commit for a bad release; delete the Custom Domain to return `learn` to the wildcard.

## 5. Risks

- Two-level subdomain TLS on the Free plan — test on `dev` first.
- `force-static` doc pages on Lambda — keep static until verified.
- `/` becomes dynamic (session read) — same cost as `/courses`.
- Removing `crossSubDomainCookies` changes the cookie `Domain` (no production sessions yet).
- Old dev-stage resources and workers.dev URLs are removed on the first new `dev` deploy (intended).
- `safePath` fallback touches the open-redirect guard — tests must pin `/home` and the rejection cases.
- `--max-warnings 0` catches unconverted `${LMS}` anchors.
- Turbopack stale-page trap — confirm with `curl`, `pnpm dev:clean`.
- Clear `apps/platform/.next` / `.open-next` after the rename.

## 6. Verification

- Per phase: `pnpm format && pnpm lint && pnpm check-types && pnpm test && pnpm build`.
- A: grep for `NEXT_PUBLIC_WEB_URL|NEXT_PUBLIC_LMS_URL|apps/web|apps/lms|dev:lms|dev:web|3001` outside `node_modules`, `.next`, `.sst`, `docs/specs`, lockfile → only historical text; `pnpm check-budget` on `:3000`; signed-out `/` 200, signed-in `/` 307 → `/home`; sitemap includes `/about` and a lesson; robots correct.
- B: browser loop (B4), two rounds; `check-budget`.
- C: `https://dev.learn.devhelp.pk/` 200, no `Domain=` on `Set-Cookie`; `_next/static` `cf-cache-status: HIT` on a second request; direct function URL returns 403 (checked without printing it); `grep -rn "lambda-url\|workers\.dev" apps packages infra scripts .github sst.config.ts` empty; certificate PDF, sign-up email, `/api/content/sync` with the bearer.

## 7. Sub-task split

| #   | Task                                                                          | Model                  | Depends on |
| --- | ----------------------------------------------------------------------------- | ---------------------- | ---------- |
| 1   | A1 rename + reference sweep                                                   | Sonnet                 | —          |
| 2   | A2 env collapse + auth cleanup + tests                                        | Sonnet                 | 1          |
| 3   | A3–A4 route groups, `/home`, redirect, shell/header/footer, links, `safePath` | Opus                   | 1, 2       |
| 4   | A5–A6 sitemap/robots/OG/JSON-LD, delete `apps/web`, budget, spec.md retro     | Sonnet                 | 3          |
| 5   | B1–B2 marketing vocabulary + landing                                          | Opus                   | 4          |
| 6   | B3 about/contribute/faq                                                       | Sonnet                 | 5          |
| 7   | B4 browser loop, `test.md`, budget                                            | Sonnet (Opus critique) | 5, 6       |
| 8   | C1 `sst.config.ts`, `infra/proxy.ts`, Next `proxy.ts`, build script           | Opus                   | 4          |
| 9   | C2–C3 bootstrap runbook + workflows + `deploy.md`                             | Sonnet                 | 8          |
| 10  | C4 dev deploy; production + DNS redirect                                      | founder + Opus         | 8, 9       |

# devhelp-platform — agent guide

Monorepo for devhelp.pk: a free, open-source learning platform (marketing site + LMS) for software engineers and students in Pakistan. `CLAUDE.md` is a symlink to this file; keep guidance here only.

## Commands (run from repo root)

```sh
pnpm install                     # Node 24, pnpm 11 (see .nvmrc / packageManager)
cp .env.example .env && pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm content:refresh             # pull the pinned devhelp-content commit, check it, sync metadata into Postgres
pnpm dev                         # web :3000, lms :3001
pnpm format && pnpm lint && pnpm check-types && pnpm test && pnpm build   # must all pass before a commit
pnpm --filter <pkg> <script>     # target one workspace, e.g. pnpm --filter @repo/database db:generate
```

Turborepo scopes tasks to the package of the current working directory. Always run `turbo` / `pnpm <task>` from the repo root, or you will only run one package's tasks and read the "Tasks: N successful" line wrong.

## Layout

| Path                                         | Package                 | Notes                                                                                                                                                         |
| -------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                                   | `web`                   | Marketing site. `/design` is the living style guide.                                                                                                          |
| `apps/lms`                                   | `lms`                   | Learning platform. `/courses` reads Postgres (`force-dynamic`).                                                                                               |
| `packages/ui`                                | `@repo/ui`              | shadcn/ui, consumed from source. Tokens + rules in `packages/ui/DESIGN.md`.                                                                                   |
| `packages/database`                          | `@repo/database`        | Drizzle ORM + postgres-js. Schema in `src/schema/*.ts`, migrations in `drizzle/`. `schema/auth.ts` is generated, do not hand-edit.                            |
| `packages/auth`                              | `@repo/auth`            | Better Auth server (`@repo/auth`) + React client (`@repo/auth/client`). Admin + organization (teams = cohorts) plugins.                                       |
| `packages/learning`                          | `@repo/learning`        | Progress engine: `recordEvent`, `enroll`, `rebuildLearner`, `evaluateCompletion`. Integration tests hit Postgres.                                             |
| `packages/content-schema`                    | `@repo/content-schema`  | Zod schemas, loader, hashing for the content repo; `@repo/content-schema/check` is the checker (shells out to vitest, never import it from app code).         |
| `packages/content`                           | `@repo/content`         | `content:pull` (tarball of the pinned sha into `.content/`) and `content:sync` (idempotent upsert into Postgres, archives removed items, scoped to the repo). |
| `packages/tailwind-config`                   | `@repo/tailwind-config` | Brand `@theme` tokens (indigo `brand-*`, `madder-*`, ink/paper).                                                                                              |
| `packages/{eslint,typescript,vitest}-config` | `@repo/*-config`        | Shared configs. `vitest-config` must be built (`tsc`) before tests; turbo handles this.                                                                       |

Apps import `@repo/ui/components/<name>`, `@repo/ui/lib/utils`, `@repo/ui/globals.css`, `@repo/database`, and `@repo/auth`. These packages are transpiled by Next (`transpilePackages`), no build step. Product docs: `docs/requirements.md` (what/why), `docs/data-model.md` (schema), `docs/spec.md` (the ordered spec tracker: one spec at a time, plan → implement → review → test → complete; update its status and commit hash when a spec finishes).

## Type safety (non-negotiable, requirement X10)

- Entity types are Drizzle-inferred (`typeof table.$inferSelect`); never hand-write a row type.
- Every `jsonb` column has a Zod schema in `packages/database/src/schema/json.ts`; the column's `.$type<>()` uses the type inferred from that schema. Validate with it at every write boundary.
- Learner progress is written only through `recordEvent` / `enroll` from `@repo/learning` (Zod-validated, transactional, idempotent). Never insert into `progress_events`, `lesson_progress`, or `enrollments` directly outside that package. `rebuildLearner(userId)` replays the stream.
- Client-facing APIs go through tRPC v11 in `packages/api` (from S3): React Query hooks on the client, direct callers in RSC. No untyped `fetch` to our own routes. Use Next `typedRoutes` for links and `@t3-oss/env-nextjs` for env.
- Quiz answers never reach the browser: read questions through `questionPublicColumns` + `toPublicOptions`.
- `packages/auth` and `packages/learning` set `declaration: false` because Better Auth / Drizzle inferred types are not portable; keep that when adding packages that re-export them.

## Content pipeline (S2)

- Curriculum lives in the public repo `devhelppk/devhelp-content` (MDX + YAML, CC BY-SA). `content.lock.json` pins the commit the platform builds against. `pnpm content:pull` downloads that sha into `.content/` (gitignored); `pnpm content:check` validates it (schema, refs, links, quiz answers, exercise tests against `solution/`); `pnpm content:sync` upserts metadata by slug and records a `content_revisions` row. `pnpm content:refresh` does all three.
- While authoring, set `CONTENT_DIR=../devhelp-content` to use a sibling checkout instead of the tarball; `pnpm content:check ../devhelp-content` works from the repo root (paths resolve from `INIT_CWD`).
- Lesson bodies are compiled at build time by Content Collections (`apps/lms/content-collections.ts`) and looked up by `lessons.content_path`; they are never stored in Postgres. New content therefore needs a platform rebuild; the promote workflow in the content repo opens a lock-bump PR on merge.
- `POST /api/content/sync` (admin session or `CONTENT_SYNC_SECRET` bearer) re-runs the sync for the deployed content. It is a recovery tool, not a publish path.
- Sync archives (never deletes) rows missing from content, and only rows previously produced by the same repo, so a sync from a fixture or another source cannot archive real content.
- `@repo/content-schema` uses explicit `.ts` import extensions because Content Collections loads it through Node's native TS loader; consumers set `allowImportingTsExtensions`. Content Collections rejects function-form schemas: pass a Zod object (loose) and do strict validation in `transform`.

## Conventions and gotchas

- **Design system first.** Read `packages/ui/DESIGN.md` before adding UI. Use existing tokens (`bg-primary`, `text-muted-foreground`, `brand-600`, `madder-600`) rather than raw colours. Do not restyle scrollbars per component; the thin themed scrollbar is global.
- **Adding shadcn components:** `cd packages/ui && pnpm dlx shadcn@latest add <name> --yes`. The CLI sometimes writes `import { cn } from "cn"` and adds a bogus `cn` dependency. Fix the import to `@repo/ui/lib/utils` and `pnpm remove cn` from `packages/ui` after every add.
- **Brand mark:** use `BrandMark` / `BrandLogo` from `@repo/ui/components/*`. Static SVGs live in `packages/ui/src/assets/brand/`; app favicons are `app/icon.svg`.
- **Internal links in apps must use `next/link`.** ESLint runs with `--max-warnings 0` and `@next/next/no-html-link-for-pages` fails the build on `<a href="/...">`.
- **TypeScript 7:** `baseUrl` is removed. Use `paths` alone (`"@/*": ["./*"]`).
- **Drizzle-kit prompts:** when a table both gains and loses columns, `pnpm db:generate` asks interactively whether each new column is a rename (first option, Enter = create). It needs a TTY; from an agent shell drive it through a pty (see `scratchpad/drive-generate.py` pattern) or run it in a real terminal. Hand-edit the SQL when a new NOT NULL column needs a backfill (add nullable, UPDATE, SET NOT NULL).
- **Database:** write `camelCase` columns in Drizzle; `casing: "snake_case"` is set in both the client (`src/index.ts`) and `drizzle.config.ts`, so Postgres columns are `snake_case`. Keep both in sync. After a schema change run `pnpm db:generate`, rename the generated file to something descriptive (update `drizzle/meta/_journal.json` `tag` to match), then `pnpm db:migrate`. `db:push` is for throwaway prototyping only. Commit migrations.
- **Auth schema:** identity tables come from the Better Auth config. Change `packages/auth/src/server.ts` (e.g. `additionalFields`), then `pnpm --filter @repo/auth auth:generate` (writes `packages/database/src/schema/auth.ts`), then `pnpm db:generate` + `pnpm db:migrate`. Use the `auth` CLI package (matches `better-auth` 1.7); `@better-auth/cli` is stale at 1.4 and emits an incompatible schema. Route handlers live at `app/api/auth/[...all]/route.ts` in each app.
- **Auth tests** in `packages/auth` hit the real local Postgres and need `BETTER_AUTH_SECRET` in `.env`.
- **Env:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, optional `GITHUB_*` / `GOOGLE_*` OAuth keys. `packages/database/src/env.ts` walks up to the repo root `.env` (marked by `pnpm-workspace.yaml`) so apps, drizzle-kit, and the seed all share it. Declare new env vars in `turbo.json` `globalEnv`.
- **Tests:** Vitest + Testing Library. UI and app tests use `@repo/vitest-config/ui` (jsdom, `vitest.setup.ts` loads jest-dom). Node packages use `@repo/vitest-config/base`. Co-locate tests as `*.test.ts(x)`.
- **Formatting:** Prettier with the Tailwind class-sorting plugin; run `pnpm format` before committing. CI runs `format:check`.
- **Ports:** web 3000, lms 3001. Stop dev servers with `pgrep -f "next dev" | xargs -r kill`; `pkill -f "next dev"` will match and kill the invoking shell.
- **Scope discipline:** the LMS product surface (courses, lessons, progress UI) is intentionally thin until the research in `../research/` is acted on. Do not add domain-specific components to `packages/ui`; keep it generic.

## Reference material (outside this repo)

- `../research/lms-starter-references.md`: verified survey of open-source LMS platforms, starters, auth (recommendation: Better Auth + Drizzle), content pipeline (MDX via Fumadocs), and schema gaps vs Moodle/Canvas/Open edX.
- `../research/curriculum-vision-review.md`: curriculum vision, learnings, and adversarial review.

## Git

- Trunk is `main`. Branch for anything non-trivial. Commit messages: imperative summary line, then a short body explaining why.
- Never commit `.env`; `.env.example` is the template.

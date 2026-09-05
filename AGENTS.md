# devhelp-platform — agent guide

Monorepo for devhelp.pk: a free, open-source learning platform (marketing site + LMS) for software engineers and students in Pakistan. `CLAUDE.md` is a symlink to this file; keep guidance here only.

## Commands (run from repo root)

```sh
pnpm install                     # Node 24, pnpm 11 (see .nvmrc / packageManager)
cp .env.example .env && pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev                         # web :3000, lms :3001
pnpm format && pnpm lint && pnpm check-types && pnpm test && pnpm build   # must all pass before a commit
pnpm --filter <pkg> <script>     # target one workspace, e.g. pnpm --filter @repo/database db:generate
```

Turborepo scopes tasks to the package of the current working directory. Always run `turbo` / `pnpm <task>` from the repo root, or you will only run one package's tasks and read the "Tasks: N successful" line wrong.

## Layout

| Path | Package | Notes |
| --- | --- | --- |
| `apps/web` | `web` | Marketing site. `/design` is the living style guide. |
| `apps/lms` | `lms` | Learning platform. `/courses` reads Postgres (`force-dynamic`). |
| `packages/ui` | `@repo/ui` | shadcn/ui, consumed from source. Tokens + rules in `packages/ui/DESIGN.md`. |
| `packages/database` | `@repo/database` | Drizzle ORM + postgres-js. Schema in `src/schema/*.ts`, migrations in `drizzle/`. |
| `packages/tailwind-config` | `@repo/tailwind-config` | Brand `@theme` tokens (indigo `brand-*`, `madder-*`, ink/paper). |
| `packages/{eslint,typescript,vitest}-config` | `@repo/*-config` | Shared configs. `vitest-config` must be built (`tsc`) before tests; turbo handles this. |

Apps import `@repo/ui/components/<name>`, `@repo/ui/lib/utils`, `@repo/ui/globals.css`, and `@repo/database`. Both packages are transpiled by Next (`transpilePackages`), no build step.

## Conventions and gotchas

- **Design system first.** Read `packages/ui/DESIGN.md` before adding UI. Use existing tokens (`bg-primary`, `text-muted-foreground`, `brand-600`, `madder-600`) rather than raw colours. Do not restyle scrollbars per component; the thin themed scrollbar is global.
- **Adding shadcn components:** `cd packages/ui && pnpm dlx shadcn@latest add <name> --yes`. The CLI sometimes writes `import { cn } from "cn"` and adds a bogus `cn` dependency. Fix the import to `@repo/ui/lib/utils` and `pnpm remove cn` from `packages/ui` after every add.
- **Brand mark:** use `BrandMark` / `BrandLogo` from `@repo/ui/components/*`. Static SVGs live in `packages/ui/src/assets/brand/`; app favicons are `app/icon.svg`.
- **Internal links in apps must use `next/link`.** ESLint runs with `--max-warnings 0` and `@next/next/no-html-link-for-pages` fails the build on `<a href="/...">`.
- **TypeScript 7:** `baseUrl` is removed. Use `paths` alone (`"@/*": ["./*"]`).
- **Database:** write `camelCase` columns in Drizzle; `casing: "snake_case"` is set in both the client (`src/index.ts`) and `drizzle.config.ts`, so Postgres columns are `snake_case`. Keep both in sync. After a schema change run `pnpm db:generate`, rename the generated file to something descriptive (update `drizzle/meta/_journal.json` `tag` to match), then `pnpm db:migrate`. `db:push` is for throwaway prototyping only. Commit migrations.
- **Env:** only `DATABASE_URL` for now. `packages/database/src/env.ts` walks up to the repo root `.env` (marked by `pnpm-workspace.yaml`) so apps, drizzle-kit, and the seed all share it. Declare new env vars in `turbo.json` `globalEnv`.
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

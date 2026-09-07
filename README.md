# devhelp-platform

Monorepo for [devhelp.pk](https://devhelp.pk): a free, open-source learning platform for software engineers and students in Pakistan, closing the gap between academia and industry with both technical and non-technical skills for the AI-engineering era.

## Stack

- [Turborepo](https://turborepo.dev) + pnpm workspaces
- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Postgres](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team)
- [Vitest](https://vitest.dev) + Testing Library
- ESLint, Prettier, GitHub Actions

## Apps and packages

| Path                         | Package                   | Purpose                                    |
| ---------------------------- | ------------------------- | ------------------------------------------ |
| `apps/web`                   | `web`                     | Marketing site, port 3000                  |
| `apps/lms`                   | `lms`                     | Learning platform, port 3001               |
| `packages/ui`                | `@repo/ui`                | shadcn/ui components, consumed from source |
| `packages/database`          | `@repo/database`          | Drizzle schema, client, migrations, seed   |
| `packages/tailwind-config`   | `@repo/tailwind-config`   | Shared theme tokens and PostCSS config     |
| `packages/eslint-config`     | `@repo/eslint-config`     | Flat ESLint configs                        |
| `packages/typescript-config` | `@repo/typescript-config` | Shared tsconfigs                           |
| `packages/vitest-config`     | `@repo/vitest-config`     | Shared Vitest configs (node + jsdom)       |

## Quick start

You need [Docker](https://docs.docker.com/get-docker/), Node 24, and pnpm 11.
Nothing else: no paid keys, no accounts, no third-party services.

```sh
pnpm install
cp .env.example .env
pnpm db:up             # Postgres, Mailpit (:8025), MinIO (:9000)
pnpm db:migrate
pnpm content:refresh   # curriculum from github.com/devhelppk/devhelp-content
pnpm db:seed           # an admin, reference data, a company, readable titles
pnpm dev               # web :3000, lms :3001
```

`content:refresh` comes **before** `db:seed`: the seed describes whatever
content is already there, and course titles live in the database rather than
the content repo (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

Sign in as `team@devhelp.pk`. Mail — sign-in links included — goes to Mailpit
at [localhost:8025](http://localhost:8025), so nothing leaves your machine.

## Scripts

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm dev`         | Run every app in dev mode              |
| `pnpm dev:web`     | Only the marketing site (and its deps) |
| `pnpm dev:lms`     | Only the LMS (and its deps)            |
| `pnpm build`       | Build everything                       |
| `pnpm lint`        | ESLint across the repo                 |
| `pnpm check-types` | TypeScript across the repo             |
| `pnpm test`        | Vitest across the repo                 |
| `pnpm db:*`        | See `packages/database/README.md`      |

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow.

## License

[MIT](./LICENSE)

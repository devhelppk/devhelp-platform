# Contributing to devhelp

Thanks for helping build a free learning platform for Pakistan's software community.

## Setup

```sh
pnpm install
cp .env.example .env
pnpm db:up            # local Postgres via Docker
pnpm db:push          # create tables
pnpm db:seed          # starter content
pnpm dev              # web on :3000, lms on :3001
```

## Where things live

- `apps/web` — marketing site (devhelp.pk)
- `apps/lms` — the learning platform
- `packages/ui` — shared shadcn/ui components and the design tokens
- `packages/database` — Drizzle schema, migrations, seed
- `packages/*-config` — shared ESLint, TypeScript, Tailwind, and Vitest config

## Adding a UI component

```sh
cd packages/ui && pnpm dlx shadcn@latest add dialog
```

Components land in `packages/ui/src/components` and are imported as `@repo/ui/components/dialog`.

## Changing the schema

Edit `packages/database/src/schema/*.ts`, then `pnpm db:generate` to create a migration and `pnpm db:migrate` to apply it. Commit the generated SQL.

## Before opening a PR

```sh
pnpm format && pnpm lint && pnpm check-types && pnpm test
```

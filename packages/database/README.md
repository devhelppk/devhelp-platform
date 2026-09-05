# @repo/database

Drizzle ORM + Postgres. Consumed from source by the Next.js apps (no build step).

```ts
import { db, schema, eq } from "@repo/database";

const published = await db.query.courses.findMany({
  where: eq(schema.courses.isPublished, true),
  with: { modules: { with: { lessons: true } } },
});
```

| Command            | What it does                                               |
| ------------------ | ---------------------------------------------------------- |
| `pnpm db:up`       | Start local Postgres via Docker (run from repo root)       |
| `pnpm db:generate` | Generate a SQL migration in `drizzle/` from schema changes |
| `pnpm db:migrate`  | Apply pending migrations                                   |
| `pnpm db:push`     | Push schema directly (prototyping only, no migration file) |
| `pnpm db:seed`     | Insert starter content                                     |
| `pnpm db:studio`   | Open Drizzle Studio                                        |

Schema lives in `src/schema/*.ts`. Column names use `snake_case` in Postgres via Drizzle's `casing` option, so write `camelCase` in TypeScript.

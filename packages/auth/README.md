# @repo/auth

Better Auth configured for devhelp: email + password (GitHub/Google when keys are set), the **admin** plugin for platform roles (`student` / `mentor` / `admin` on `users.role`), and the **organization** plugin with teams enabled (organizations = institutions/communities, teams = cohorts).

```ts
// Server (RSC, server actions, route handlers)
import { auth } from "@repo/auth";
const session = await auth.api.getSession({ headers: await headers() });

// Client components
import { authClient, useSession } from "@repo/auth/client";
```

| Command              | What it does                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pnpm auth:generate` | Regenerate `packages/database/src/schema/auth.ts` from this config (then run `pnpm db:generate` + `db:migrate` at the root) |
| `pnpm test`          | Integration tests against the local Postgres (`pnpm db:up` + migrations + `BETTER_AUTH_SECRET` in `.env`)                   |

Notes: with teams enabled, creating an organization also creates a default team named after it. Only `mentor` and `admin` users can create organizations. See `docs/data-model.md` for how these entities map to the product.

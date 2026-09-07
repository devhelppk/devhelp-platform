# Contributing

Two repositories, and which one you want depends on what you are changing.

| You want to change                                     | Repository                                      |
| ------------------------------------------------------ | ----------------------------------------------- |
| A lesson's words, a quiz question, an exercise's tests | `devhelppk/devhelp-content`                     |
| The platform: pages, API, schema, tooling              | this one                                        |
| A course or lesson **title, summary, level, duration** | neither — they are edited in the app, see below |

That last row surprises people. Since S11 the content repository owns _what
content is_ — bodies, quiz files, exercise files, structure — and the platform
owns _how it is described_. Titles, summaries, levels, durations, cover images,
publish state, and credits live in Postgres and are edited by mentors at
`/studio`. Putting a `title:` back into a lesson fails `content:check` with a
message telling you where it went. The reason is that correcting a typo in a
title should not need a pull request, a review, and a deploy, while changing
what a lesson teaches should need all three.

## Running it

You need [Docker](https://docs.docker.com/get-docker/), Node 24, and pnpm 11.
No paid keys, no accounts, nothing to sign up for.

```sh
git clone https://github.com/devhelppk/devhelp-platform.git
cd devhelp-platform
pnpm install
cp .env.example .env
pnpm db:up          # Postgres, Mailpit (mail at :8025), MinIO (storage)
pnpm db:migrate
pnpm content:refresh   # pull the pinned curriculum, check it, load it
pnpm db:seed        # an admin, reference data, a company, and readable titles
pnpm dev            # web on :3000, lms on :3001
```

Sign in as `team@devhelp.pk` — email goes to Mailpit at
[localhost:8025](http://localhost:8025), including the sign-in and
verification links, so nothing leaves your machine.

## Before you open a pull request

```sh
pnpm format && pnpm lint && pnpm check-types && pnpm test && pnpm build
```

CI runs exactly this, against an empty database. If a test passes for you and
fails in CI, the usual reason is that your local database has rows CI does not:
drop it, migrate, sync, seed, and run again.

## How the code is meant to be written

`AGENTS.md` is the working guide — conventions, the schema rules, the
moderation model, and every trap this codebase has already fallen into. It is
worth reading before a first change; most review comments would be a line in
there.

The short version:

- Entity types are Drizzle-inferred. Never hand-write a row type.
- Every `jsonb` column has a Zod schema in `packages/database/src/schema/json.ts`.
- Client-facing APIs go through tRPC in `packages/api`. No untyped `fetch` to
  our own routes.
- Anything a person submits is moderated, and every decision writes an audit
  row in the same transaction as the change it describes.
- Anything touching a UI needs the browser loop: both themes, 1440 px and
  390 px, console clean.

## Content licence

Code here is MIT. The curriculum in `devhelppk/devhelp-content` is CC BY-SA
4.0: use it, fork it, teach from it, and credit the people who wrote it.

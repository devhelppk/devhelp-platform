# S2 plan: content pipeline

Status: `planned`, awaiting founder approval. Spec entry: `docs/spec.md` → S2. Requirements: area 3 option C, F3.1, F3.2, F3.5, F3.6, N3.1, N3.3, N1.3; X10 (type safety). Builds on S1 tables (`courses`, `modules`, `lessons`, `quizzes`, `questions`, `exercises`, `paths`, `path_courses`, `content_revisions`).

## Goal

Content is a public git repository of MDX and YAML. The platform validates it in CI, compiles lesson bodies at build time, and syncs metadata into Postgres by slug at deploy time, recording which content commit produced each row. After S2 a lesson written in the content repo renders in the LMS with the design system's prose styles, and progress rows survive any content change.

## Decisions

1. **Separate public repo `devhelppk/devhelp-content`** (CC BY-SA 4.0). Layout per F3.1. Creating it is an outward-facing action; implementation creates it under the org the founder named, public, with branch protection deferred until CI exists.
2. **The platform pins the content commit.** `content.lock.json` at the platform root holds `{ repo, ref, sha }`. `pnpm content:pull` fetches that sha (GitHub tarball, no git history, no submodule) into `.content/` (gitignored). Every build reads from `.content/`. A content merge is promoted by bumping the lock (a GitHub Action in the content repo opens a PR against the platform; the founder or CI merges it). This keeps builds reproducible and reviewable and avoids submodule friction for contributors.
3. **Sync happens at deploy time, not by webhook.** `pnpm content:sync` runs after `next build` (Vercel build command, and locally after `content:pull`). It upserts metadata from `.content/` into Postgres and writes a `content_revisions` row for the sha. The `POST /api/content/sync` endpoint from the requirements becomes an admin-only "re-run sync for the deployed sha" trigger (signed with `CONTENT_SYNC_SECRET`), used for recovery, not for pushing new content, because compiled MDX must match the deployed build.
4. **Content Collections compiles MDX** (`@content-collections/core`, `/mdx`, `/next`; Next ≥12..16 peer, Zod schema per collection, Turbopack OK). Chosen over fumadocs-mdx 15 whose peers now include Vite, Rolldown, and Satteri. Collections point at `.content/courses/**/*.mdx` and reuse the Zod frontmatter schema from `@repo/content-schema`. Fallback if Content Collections disappoints: fumadocs-mdx, same schema package, only the collection config changes.
5. **`@repo/content-schema` is the single source of truth** for what content looks like: Zod schemas, inferred types, a loader that reads a content directory into a typed tree, and a `check()` that returns structured diagnostics. It is not published to npm; the content repo's CI checks out both repositories and runs the check from the platform checkout (see CI section), and locally a contributor runs `pnpm content:check` from the platform repo against a sibling content checkout (`CONTENT_DIR`).
6. **Slugs are the identity, `content_hash` is the change detector.** Sync upserts by `(course.slug)`, `(course, module.slug)`, `(course, lesson.slug)`. Rows present in the DB but absent from content are archived (`archived_at`), never deleted, so `lesson_progress` and `progress_events` keep their foreign keys. Unchanged hashes skip the write so `updated_at` stays honest.
7. **Quiz answers live in content, are synced to Postgres, and never leave the server**: `questions.options[].isCorrect` and `answer` come from the quiz YAML; the lesson page reads through `questionPublicColumns` (S1).
8. **Lesson bodies are not stored in Postgres.** `lessons.content_path` is the file path inside the content repo; the LMS resolves the compiled body from the Content Collections output by that path. This keeps the DB small and the render path static.
9. **Badge and company-facts schemas are defined now, synced later** (S8, S10). Defining them now lets content authors start files without a later schema break.
10. **Exercise tests run in `content:check`** using the same runner contract the platform will use in S4: Sandpack exercises are checked with a Node-side `vitest`-style harness over `testFiles`; Pyodide exercises are syntax-checked only in S2 (full run in S4). Documented as a known limit.

## Content repo layout (`devhelppk/devhelp-content`)

```
LICENSE (CC BY-SA 4.0)      README.md      CONTRIBUTING.md      .github/workflows/check.yml
paths/
  ai-engineering.yaml          # slug, title, summary, description, courses: [slug...], published
courses/
  ai-engineering-foundations/
    course.yaml                # slug, title, summary, description, track, level, estimatedHours, prerequisites, completionCriteria, published, authors, cover
    01-getting-started/
      module.yaml              # slug, title, summary
      01-welcome.mdx           # frontmatter: slug, title, type, completionRule, mode, isRequired, isFree, durationMinutes, authors, reviewers, updated
      02-how-agents-work.mdx   # type: video, video: { provider: youtube, id }
      03-foundations-check.mdx # type: quiz, quiz: foundations-check
    quizzes/
      foundations-check.yaml   # passScore, maxAttempts, shuffle, questions: [{ id, type, prompt, options: [{ id, text, correct, feedback }], answer, explanation, points }]
    exercises/
      hello-agent/             # README.mdx (instructions), starter/, tests/, exercise.yaml (runner, language)
badges/
  first-lesson.yaml            # slug, name, description, icon, rule
companies/
  arbisoft.yaml                # verified facts only
```

Ordering comes from the numeric prefix on module and lesson files; slugs are explicit in frontmatter so renaming a file does not change identity.

## `@repo/content-schema`

- `src/schemas/{course,module,lesson,quiz,exercise,path,badge,company}.ts`: Zod 4 schemas with `.strict()`, exported types via `z.infer`. Lesson frontmatter discriminates on `type` (video requires `video`, quiz requires `quiz`, exercise requires `exercise`, project requires `project.rubric`).
- `src/load.ts`: `loadContentTree(dir)` → `{ paths, courses: [{ meta, modules: [{ meta, lessons: [{ meta, body, filePath }] }], quizzes, exercises }], badges, companies }`, with every file parsed and every cross-reference resolved (lesson → quiz id, path → course slug, prerequisites).
- `src/check.ts`: `checkContent(tree)` → `Diagnostic[]` (`{ level, file, line?, rule, message }`). Rules: schema validity, unique slugs, references resolve, exactly one correct option for `single`, ≥1 for `multi`, `answer` present for `short`, internal links resolve, images exist, `completionRule` matches `type`, required lessons exist per course, exercise tests pass (see decision 10), style rules (title case, summary length, no "Lorem").
- `src/hash.ts`: stable `contentHash` per course/module/lesson/quiz/exercise (sha256 of canonical JSON + body).
- CLI `bin/content-check.ts` (`pnpm --filter @repo/content-schema check <dir>`), exit 1 on errors, pretty output, `--json`.
- Tests: fixtures under `test/fixtures/{valid,invalid-*}` covering each rule.

## `@repo/content` (platform-side)

- `src/pull.ts`: `content:pull` reads `content.lock.json`, downloads `https://codeload.github.com/<repo>/tar.gz/<sha>` to `.content/`, verifies the sha matches the tarball's top-level directory name, writes `.content/.sha`.
- `src/sync.ts`: `syncContent({ dir, sha })` → in one transaction per course: upsert `content_revisions`; upsert course, modules, lessons (with `content_path`, `content_hash`, `content_revision_id`), quizzes + questions (replace questions atomically, bump `version` when hash changes), exercises, paths + path_courses; archive rows missing from content; return a summary `{ created, updated, unchanged, archived }`. Idempotent: a second run reports all `unchanged`.
- CLI `bin/content-sync.ts` (`pnpm content:sync`), plus `apps/lms/app/api/content/sync/route.ts` (admin session or `CONTENT_SYNC_SECRET` header) that runs the same function against the deployed `.content/`.
- Tests (Postgres): sync a fixture twice (idempotent), remove a lesson and re-sync (archived, progress rows intact via a `recordEvent` before/after), change a quiz (version bumps), change a slug (treated as new + archive old, documented).

## Platform wiring

- `content-collections.ts` at `apps/lms` root: `lessons` collection over `.content/courses/**/*.mdx` with `schema` from `@repo/content-schema`, MDX transform with `remark-gfm`, `rehype-slug`, Shiki code highlighting (theme tokens from the design system), and a `readingTime` computed field. `next.config.ts` wrapped with `withContentCollections`.
- `apps/lms/lib/content.ts`: `getLessonBody(contentPath)` resolving from the collection; `MDXContent` client component with the design system's `prose-lesson` utility and a small component map (callout, code block with copy button, video embed placeholder).
- Minimal render route to prove it end to end: `apps/lms/app/courses/[course]/[lesson]/page.tsx` (static, `generateStaticParams` from the collection) showing title, meta, and body. Full lesson experience (progress, Continue, sidebar) is S3; this route is intentionally plain and will be replaced.
- `.gitignore`: `.content/`, `.content-collections/`. `turbo.json`: `content:pull` (no cache), `content:sync` (no cache, depends on `^build`), `build` inputs include `.content/**`; `globalEnv` adds `CONTENT_SYNC_SECRET`, `CONTENT_DIR`.
- Root scripts: `content:pull`, `content:check` (runs the schema check against `.content/`), `content:sync`.
- Seed: `pnpm db:seed` keeps seeding auth/dev fixtures but course content now comes from `pnpm content:pull && pnpm content:sync`; the S1 seed courses are moved into the content repo as its first two courses so nothing is lost.

## Content repo CI (`.github/workflows/check.yml`)

Checks out `devhelp-content` and `devhelp-platform` (pinned to `main`), installs the platform with pnpm, runs `pnpm --filter @repo/content-schema check ../devhelp-content`. On merge to `main`, a second workflow opens a PR on the platform repo bumping `content.lock.json` to the merged sha (via `peter-evans/create-pull-request`), which triggers the platform's own CI (which runs `content:pull`, `content:check`, build, and the sync tests against Postgres).

## Files

- New: `packages/content-schema/**`, `packages/content/**`, `content.lock.json`, `apps/lms/content-collections.ts`, `apps/lms/lib/content.ts`, `apps/lms/components/mdx/**`, `apps/lms/app/courses/[course]/[lesson]/page.tsx`, `apps/lms/app/api/content/sync/route.ts`, `.github/workflows/ci.yml` (add pull + check + sync-test steps, Postgres service).
- Changed: `apps/lms/next.config.ts`, `apps/lms/package.json`, `turbo.json`, root `package.json`, `.gitignore`, `.env.example`, `packages/database/src/seed.ts` (drop course content), `AGENTS.md`, `docs/data-model.md` (content ownership note), `docs/requirements.md` (F3.5 wording: deploy-time sync).
- External: the `devhelppk/devhelp-content` repository with two courses, one path, one quiz, one exercise, one badge file, one company file, CI, license, contributing guide.

## Tests

1. Schema: every fixture in `invalid-*` produces the expected diagnostic rule; `valid` produces none.
2. Loader: cross-references resolve; ordering follows numeric prefixes; slugs are taken from frontmatter not filenames.
3. Check CLI: exit code 1 on errors, 0 on warnings only, `--json` output shape.
4. Sync (Postgres): idempotent second run; archived lesson keeps its `lesson_progress` and `progress_events` rows and stays excluded from completion maths (uses S1 `recordEvent` + `rebuildLearner`); quiz question change bumps `version` and replaces options atomically; `content_revisions` row per sha; summary counts correct.
5. Render: the LMS lesson route renders the compiled body for a fixture lesson (Vitest + Testing Library on the RSC output, or a build-time smoke via `next build` + `curl`); code block and callout components render.
6. Pipeline: `content:pull` for the pinned sha, `content:check`, `content:sync`, then the existing suites; CI runs the same with a Postgres service.

## Out of scope

Keystatic studio and mentor dashboard (S11), lesson UX beyond the plain proof route (S3), quiz grading and exercise runners in the browser (S4), badge and company sync (S8, S10), on-demand ISR revalidation beyond what a deploy does.

## Acceptance criteria (from spec.md)

- [ ] `content:check` fails on a bad quiz answer, a broken link, and a failing exercise test; passes on the sample content.
- [ ] Sync is idempotent: running twice produces no row changes; removing a lesson archives it and keeps its progress rows.
- [ ] A lesson body renders in the LMS from the compiled MDX with prose styles.
- [ ] Certificates-to-revision linkage is possible: each synced lesson row has a `content_revisions` entry with the commit SHA.

## Open points for the founder

1. Confirm creating the public `devhelppk/devhelp-content` repo now (implementation does it with `gh`).
2. Decision 3 replaces the push webhook with deploy-time sync plus a lock-bump PR. Fine, or do you want content merges to go live without a platform deploy? (That would require runtime MDX compilation and is the Payload-style path.)

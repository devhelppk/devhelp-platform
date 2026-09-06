# S2 test record

Date: 2026-09-06. Local Postgres 17 (`pnpm db:up`), content pinned to `devhelppk/devhelp-content@46310df`.

## Content repo

- `pnpm content:check ../devhelp-content` (sibling checkout): 2 courses, 1 path, 0 errors, 0 warnings. The exercise runner executed `trace-the-refund` tests against `solution/` (pass) and `starter/` (fails one, as intended).
- Repo pushed to GitHub with `check.yml` (validates PRs against the platform schema) and `promote.yml` (opens a lock-bump PR on the platform on merge; needs the `PLATFORM_PR_TOKEN` secret to be set by the founder).

## `@repo/content-schema` (9 tests)

Loader ordering and slug identity; stable hashing independent of key order; valid fixture passes; single-choice quiz without exactly one correct option fails (`answer`); broken internal link fails (`link`); mismatched completion rule fails (`completion-rule`); an exercise whose solution fails its tests fails (`tests`, real vitest subprocess); a missing `courses/` directory and a missing `NN-` order prefix are reported; an unquoted YAML date stays a string.

## `@repo/content` (9 integration tests)

First sync creates rows; second sync reports everything `unchanged`; a new sha leaves unchanged rows untouched (`updated_at`, revision id) and is the newest `content_revisions` row; a quiz change bumps `version` and replaces questions atomically; removing a lesson archives it, keeps its `lesson_progress` and `progress_events` rows, and the course completes from the remaining required lesson (via `@repo/learning`); a sync from another repo's tree never archives this repo's content; schema errors refuse to sync; a renamed lesson file updates `position` and `content_path`; an empty or missing directory is refused; a path referencing an unknown course is refused with the checker's diagnostic.

## Platform

- `pnpm content:pull` downloads the pinned tarball, verifies the sha, writes `.content/.sha`; second run is a no-op.
- `pnpm content:sync` twice: first run `courses ~2 lessons +1 ~4`, second run all `=` (idempotent). Migration `0002_path_content_revision` applied.
- Built LMS: `/courses/ai-engineering-foundations/welcome` renders the compiled body inside `.prose-lesson` with `h2` anchors (rehype-slug); the video lesson embeds `youtube-nocookie`; the communication lesson renders the code block with the Copy button; an unknown lesson returns 404.
- `POST /api/content/sync`: 401 without credentials; with the bearer secret returns the sync summary for the deployed sha.
- Full pipeline `format && lint && check-types && test && build`: 28/28 Turborepo tasks (ui 9, database 1, lms 1, auth 4, learning 16, content-schema 9, content 9). `format:check` clean.
- `CONTENT_DIR` resolution verified from the repo root: unset → `.content`, `../devhelp-content` → sibling checkout, empty string → `.content`.
- CI updated: Postgres service, `content:pull`, `content:check`, `db:migrate`, `content:sync` before lint/types/tests/build.

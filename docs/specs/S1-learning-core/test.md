# S1 test record

Date: 2026-09-06. All runs against the local Postgres 17 container (`pnpm db:up`).

## Migration

- Fresh volume: `0000_initial_schema` + `0001_learning_core` apply cleanly; `pnpm db:seed` twice in a row is idempotent (same counts: 2 courses, 4 lessons, 2 questions); `drizzle-kit generate` reports no drift.
- On top of a `0000`-shaped database with legacy rows (course, module without slug, lesson, completed enrolment, lesson_progress): `0001` applied via psql in one transaction; `lessons.course_id` and `lesson_progress.course_id` backfilled, `modules.slug` derived from the title (`Getting Started!` → `getting-started`), statuses and percentages backfilled from `completed_at`.

## `@repo/learning` (16 tests, Vitest, integration against Postgres with a 10-connection pool)

| Test                                                                                                                                 | Covers        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| duplicate idempotency key ignored, read models byte-identical (incl. updatedAt)                                                      | acceptance 2  |
| auto-enrol on first lesson event, `course_enrolled` emitted, `enrollment_count` incremented                                          | decision 4    |
| optional lesson never completes; last required lesson flips enrolment to completed in the same call, `course_completed` emitted once | acceptance 3  |
| two concurrent completions of the last two lessons emit exactly one `course_completed`                                               | decision 6    |
| monotonic progress (late lower tick does not regress), drop then re-enrol reactivates                                                | reducer rules |
| lesson from another course is rejected before the transaction                                                                        | validation    |
| rebuild reproduces read models byte-for-byte, including `updated_at`; replay appends no events                                       | acceptance 4  |
| archived required lesson excluded from completion; rebuild agrees                                                                    | decision 7    |
| criteria evaluator: default, zero-lesson course, quiz/project unmet until S4/S8, unknown keys rejected                               | decision 5    |

## Repo pipeline

`pnpm format && pnpm lint && pnpm check-types && pnpm test && pnpm build`: 22/22 Turborepo tasks pass (ui 9 tests, database 1, lms 1, auth 4, learning 16); `pnpm format:check` clean. Built LMS `/courses` page renders both seeded courses from the new schema (HTTP 200).

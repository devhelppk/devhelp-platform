# S1 plan: data model v1, learning core

Status: `planned`, awaiting founder approval. Spec entry: `docs/spec.md` → S1. Requirements: F1.1, F1.2, F1.8, F1.9, F1.11, F1.11a, F1.13, N1.2, N1.3; area 4 hook F4.6 (aggregate columns reserved). Data-model principles: `docs/data-model.md`.

## Goal

Replace the placeholder learning schema with the real one and ship the progress engine: an append-only event stream with transactional read models and a rebuild path. No UI. Everything later (catalogue, quizzes, certificates, cohorts) builds on these tables without renaming them.

## Decisions

1. **New package `packages/learning` (`@repo/learning`)** holds the progress service and criteria evaluator. `@repo/database` stays schema + client only. Apps import `@repo/learning` for writes and `@repo/database` for reads.
2. **Event stream is the source of truth.** `progress_events` is append-only with a unique `idempotency_key`. `lesson_progress` and `enrollments` are read models updated in the same transaction as the event insert. `rebuildLearner(userId)` replays the stream and must reproduce the read models exactly.
3. **Idempotency key is caller-supplied**, shape `${kind}:${userId}:${subjectId}[:${clientNonce}]`. Completion events omit the nonce (a lesson completes once); progress ticks include one. Duplicate keys are ignored, not errored (`ON CONFLICT DO NOTHING`), and the call reports `duplicate: true`.
4. **Auto-enrol on first lesson event.** A signed-in learner who starts a lesson in a course they have not enrolled in gets an `active` enrollment and a `course_enrolled` event in the same transaction. One-click enrol (F1.10) is the same code path with no lesson.
5. **Course completion is derived** from `courses.completion_criteria` (jsonb). S1 evaluates `requireAllRequiredLessons` (default true). `minQuizScore` and `requireProjectAccepted` are validated by the Zod schema but evaluate to "not satisfiable yet" until S4 and S8 add attempt and submission data. The evaluator is a pure function so S4/S8 extend it without touching the transaction code.
6. **Concurrency:** the transaction locks the `(user_id, course_id)` enrollment row `FOR UPDATE` before recomputing course progress, so two lessons completing at once cannot both emit `course_completed`.
7. **Archive, never delete** content rows (`archived_at`), so progress history survives content removal (N1.3). Archived required lessons are excluded from completion maths.
8. **Quiz and exercise definitions live in S1; attempts and submissions in S4.** Correct answers are stored in `questions.options` / `questions.answer` and are never exposed by a query helper; `@repo/database` will export a `questionPublicColumns` selection for client-facing reads.
9. **Aggregate columns reserved now** (`lessons.rating_avg`, `lessons.rating_count`, `courses.rating_avg`, `courses.rating_count`, `courses.enrollment_count`) so S6 does not need to alter hot tables. Nullable, unused until S6.
10. **Migration is incremental** (`0001_learning_core`) on top of `0000_initial_schema`, per the acceptance criteria, with a hand-added backfill for the two existing dev rows shapes (see Migration).

## Schema

All files in `packages/database/src/schema/`. Column names camelCase in TS, snake_case in Postgres via `casing`. Every FK gets an index. `uuid` PKs with `defaultRandom()`.

### `courses.ts`

Enums: `course_track` (technical, career), `course_level` (beginner, intermediate, advanced), `lesson_type` (article, video, exercise, quiz, project, link), `completion_rule` (view, quiz_pass, exercise_pass, submit), `lesson_mode` (foundation, industry), `video_provider` (youtube).

| Table                  | Columns                                                                                                                                                                                                                                                                                                                                                                                                                   | Constraints                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `courses`              | id, slug, title, summary, description, track, level, coverImageUrl, estimatedHours int, isPublished bool, publishedAt, archivedAt, authorId → users (set null), contentPath, contentHash, contentRevisionId → content_revisions (set null), completionCriteria jsonb default `{"requireAllRequiredLessons":true}`, ratingAvg numeric(3,2), ratingCount int default 0, enrollmentCount int default 0, createdAt, updatedAt | unique slug; index isPublished                    |
| `course_prerequisites` | courseId → courses (cascade), prerequisiteId → courses (cascade)                                                                                                                                                                                                                                                                                                                                                          | PK (courseId, prerequisiteId)                     |
| `modules`              | id, courseId → courses (cascade), slug, title, summary, position int, archivedAt                                                                                                                                                                                                                                                                                                                                          | unique (courseId, slug); index courseId           |
| `lessons`              | id, moduleId → modules (cascade), courseId → courses (cascade, denormalised for progress maths), slug, title, type, completionRule, mode default foundation, isRequired bool default true, isFree bool default true, durationMinutes, position, videoProvider, videoId, contentPath, contentHash, contentRevisionId, archivedAt, ratingAvg, ratingCount, createdAt, updatedAt                                             | unique (courseId, slug); index moduleId, courseId |
| `paths`                | id, slug, title, summary, description, isPublished, position, archivedAt, createdAt, updatedAt                                                                                                                                                                                                                                                                                                                            | unique slug                                       |
| `path_courses`         | pathId → paths (cascade), courseId → courses (cascade), position                                                                                                                                                                                                                                                                                                                                                          | PK (pathId, courseId)                             |

`content` text column on `lessons` is **dropped**; bodies come from compiled MDX in S2. `contentPath` is the path inside the content repo.

### `assessments.ts`

Enums: `question_type` (single, multi, short), `exercise_runner` (sandpack, pyodide).

| Table       | Columns                                                                                                                                                                                                            | Constraints     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `quizzes`   | id, lessonId → lessons (cascade), passScore smallint (percent, default 70), maxAttempts smallint nullable, shuffle bool, version int default 1, contentHash, createdAt, updatedAt                                  | unique lessonId |
| `questions` | id, quizId → quizzes (cascade), position, type, prompt, options jsonb `[{id,text,isCorrect,feedback}]`, answer jsonb (short-answer accepted values), explanation, points smallint default 1, version int default 1 | index quizId    |
| `exercises` | id, lessonId → lessons (cascade), runner, language, starterFiles jsonb, testFiles jsonb, instructions text (MDX excerpt or path), version int, contentHash, createdAt, updatedAt                                   | unique lessonId |

### `progress.ts`

Enums: `enrollment_status` (active, completed, dropped), `progress_status` (not_started, in_progress, completed), `progress_event_kind` (course_enrolled, course_completed, course_dropped, lesson_started, lesson_progressed, lesson_completed, quiz_attempted, exercise_submitted, project_submitted).

| Table             | Columns                                                                                                                                                                                                                        | Constraints                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `enrollments`     | userId → users (cascade), courseId → courses (cascade), status default active, progressPercent smallint default 0, lastLessonId → lessons (set null), teamId → teams (set null), enrolledAt, completedAt, droppedAt, updatedAt | PK (userId, courseId); index courseId, teamId                             |
| `lesson_progress` | userId → users (cascade), lessonId → lessons (cascade), courseId → courses (cascade), status default not_started, progressPercent smallint default 0, lastPositionSeconds int, startedAt, completedAt, updatedAt               | PK (userId, lessonId); index (userId, courseId)                           |
| `progress_events` | id, userId → users (cascade), kind, courseId → courses (set null), lessonId → lessons (set null), payload jsonb, idempotencyKey text, occurredAt (client time, default now), recordedAt default now                            | unique idempotencyKey; index (userId, occurredAt), (courseId), (lessonId) |

### `content.ts`

| Table               | Columns                                                                             | Constraints              |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------ |
| `content_revisions` | id, repo text, commitSha text, publishedAt default now, summary text, itemCount int | unique (repo, commitSha) |

### Relations

`relations()` for every FK so `db.query.courses.findMany({ with: { modules: { with: { lessons: true } } } })`, `db.query.enrollments`, `db.query.paths` work. The existing `users` relations file is generated by Better Auth and not edited; learning-side relations are declared from the learning tables only.

## `packages/learning` API

```ts
// @repo/learning
recordEvent(input: {
  userId: string;
  kind: ProgressEventKind;
  courseId?: string;
  lessonId?: string;
  payload?: Record<string, unknown>;   // e.g. { positionSeconds, percent }
  idempotencyKey: string;
  occurredAt?: Date;
}): Promise<{ duplicate: boolean; eventId?: string; courseCompleted?: boolean }>;

rebuildLearner(userId: string): Promise<{ events: number }>;

evaluateCompletion(criteria: CompletionCriteria, facts: CompletionFacts): { complete: boolean; unmet: string[] };

enroll(userId, courseId, opts?: { teamId? }): Promise<{ duplicate: boolean }>;   // sugar over recordEvent(course_enrolled)
```

Internals (`src/reducer.ts`): `applyEvent(tx, event, { emit: boolean })` is the single place read models change. `recordEvent` calls it with `emit: true` (may insert a derived `course_completed` event); `rebuildLearner` deletes the learner's `lesson_progress` rows, resets derived enrollment columns, and replays events ordered by `(occurredAt, recordedAt, id)` with `emit: false`, since derived events are already in the stream.

Reducer rules

- `lesson_started` → upsert `lesson_progress` to `in_progress` if not completed; set `startedAt` once; set `enrollments.lastLessonId`.
- `lesson_progressed` → update `progressPercent` (monotonic max) and `lastPositionSeconds`; never regresses a completed lesson.
- `lesson_completed` → set `completed`, `progressPercent = 100`, `completedAt` once; then recompute course.
- `course_enrolled` → insert enrollment (`active`) if absent; if `dropped`, reactivate.
- `course_dropped` → status `dropped`, `droppedAt`.
- `course_completed` → status `completed`, `completedAt`, `progressPercent = 100`.
- `quiz_attempted`, `exercise_submitted`, `project_submitted` → stored only (S4/S8 attach behaviour).

Course recompute (after any lesson event): lock enrollment `FOR UPDATE`; `required = count(lessons where courseId, isRequired, archivedAt is null)`; `done = count(lesson_progress completed ∩ required)`; `progressPercent = round(done / required * 100)`; if `status = active` and `evaluateCompletion(...)` is complete → emit `course_completed` (key `course_completed:${userId}:${courseId}`).

Validation: inputs validated with Zod; unknown `kind` or a lesson from a different course than `courseId` throws before the transaction.

## Migration

`pnpm db:generate` → rename to `0001_learning_core`. Hand-append at the end of the SQL:

```sql
-- Backfill dev rows created under the placeholder schema.
UPDATE lesson_progress SET status = 'completed', progress_percent = 100 WHERE completed_at IS NOT NULL;
UPDATE enrollments SET status = 'completed', progress_percent = 100 WHERE completed_at IS NOT NULL;
```

`lessons.course_id` is added NOT NULL; since dev data is disposable, the migration adds it nullable, backfills from `modules.course_id`, then sets NOT NULL (three statements, hand-ordered). Drizzle's snapshot is regenerated after the manual edit with `drizzle-kit check` to confirm no drift.

## Seed

`packages/database/src/seed.ts` becomes idempotent (upsert by slug) and creates: path "AI Engineering Foundations"; course "AI Engineering Foundations" (technical, beginner, 12 h) with module "Getting started" and lessons: `welcome` (article, view), `how-agents-work` (video, youtube id placeholder, view), `foundations-check` (quiz, quiz_pass) with a quiz of two single-choice questions; plus a `career` track course "Communication for engineers" with one article lesson so the catalogue has two tracks. A `content_revisions` row `repo=seed, commitSha=seed` is attached.

## Files

- `packages/database/src/schema/{courses,assessments,progress,content}.ts` (replace `courses.ts`, `learning.ts`), `index.ts` exports, `src/seed.ts`, `drizzle/0001_learning_core.sql` + meta.
- `packages/learning/{package.json,tsconfig.json,eslint.config.mjs,vitest.config.ts,README.md}`, `src/{index,record-event,reducer,rebuild,criteria,types}.ts`, `src/*.test.ts`.
- `apps/lms/app/courses/page.tsx`: adjust query to new columns (no UI change).
- `docs/data-model.md`: update tables to match; `docs/spec.md`: S1 status and commit.
- `AGENTS.md`: note `@repo/learning` and the "writes go through recordEvent" rule.

## Tests (`packages/learning/src/*.test.ts`, against local Postgres)

1. Duplicate idempotency key: second `recordEvent` returns `duplicate: true`, event count unchanged, read models unchanged (row snapshot equality).
2. Completion flips in-transaction: complete the last required lesson; in the same call's result `courseCompleted` is true; `enrollments.status = completed` and a `course_completed` event exist; completing a non-required lesson does not flip it.
3. Rebuild equality: create a mixed history for a learner (start, progress ticks, completions, drop and re-enrol), snapshot `lesson_progress` + `enrollments`, run `rebuildLearner`, compare snapshots byte-for-byte (excluding `updatedAt`, which is asserted to be later).
4. Auto-enrol: `lesson_started` without an enrollment creates one and a `course_enrolled` event.
5. Concurrency: two `recordEvent` calls completing the last two required lessons run with `Promise.all`; exactly one `course_completed` event exists.
6. Archived lessons: archiving a required lesson after partial progress makes the course completable by the remaining lessons; rebuild agrees.
7. Criteria evaluator unit tests: default criteria; `minQuizScore` present returns `complete: false` with `unmet: ["minQuizScore"]` until S4.
8. Existing suites (`@repo/auth`, `@repo/database` schema test, apps) still pass; migration applies on a fresh volume and on the current dev DB.

## Out of scope

Quiz attempts and grading (S4), exercise submissions (S4), certificates (S7), badges and streak maths (S8; the event stream already supports them), cohort syllabus (S9), any UI.

## Acceptance criteria (from spec.md)

- [ ] Migration `0001_learning_core` applies on a fresh DB and on top of the current one.
- [ ] Recording the same event twice leaves one row and unchanged read models.
- [ ] Completing all required lessons flips `enrollments.status` to `completed` inside the same transaction.
- [ ] `rebuildLearner` reproduces read models byte-for-byte from the stream.
- [ ] Integration tests cover the four points above against Postgres.

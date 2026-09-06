# devhelp spec tracker

One spec at a time: **plan → implement → review → test → complete**. A spec is complete only when every acceptance criterion is met, `pnpm format && pnpm lint && pnpm check-types && pnpm test && pnpm build` pass, and the change is committed. Nothing starts until the previous spec is complete, unless marked parallel-safe.

Source documents: `requirements.md` (what and why), `data-model.md` (schema decisions). Requirement ids (F1.11, X2, …) refer to `requirements.md`.

Each spec gets its own directory under `docs/specs/<id>-<slug>/` holding `plan.md` (written in the plan step, approved before implementation) and, as the work proceeds, `review.md` (code-review findings and what was done about them) and `test.md` (what was tested, how, and the results). The spec's entry here links to that directory and carries the status.

## Type-safety rule (applies to every spec)

Requirement X10: Drizzle-inferred types only, Zod for every jsonb column and every write boundary, tRPC v11 for any client-facing API (introduced in S3 as `packages/api`), `typedRoutes`, validated env. A spec is not complete if it adds a hand-written entity type, an unvalidated jsonb write, or an untyped fetch.

## Status legend

| Status        | Meaning                                                 |
| ------------- | ------------------------------------------------------- |
| `done`        | Complete per the definition above, commit hash recorded |
| `in-progress` | Currently being worked; only one spec at a time         |
| `planned`     | Plan written and agreed, not started                    |
| `todo`        | Not yet planned                                         |

## Lifecycle for each spec

1. **Plan.** Write `docs/specs/<id>-<slug>/plan.md`: decisions, schema, API, files to touch, tests, out of scope. Founder approves; status becomes `planned`.
2. **Implement.** Build exactly the plan. Schema changes go through `pnpm db:generate` with a named migration.
3. **Review.** `/code-review` on the diff; fix findings; record them and any deliberate leftovers in `review.md`.
4. **Test.** Unit tests for logic, integration tests against Postgres where data is involved, a browser check for UI. All existing tests still pass. Summarise in `test.md`.
5. **Complete.** Update status, record commit, tick acceptance criteria, add follow-ups to the backlog at the bottom.

---

## Done

### S0. Platform foundation — `done`

Monorepo, design system, Better Auth with organizations and cohorts, docs. Commits `824763a` → `edb5bbc`.

---

## Sequence

### S1. Data model v1: learning core — `done` (`4f9319b`)

Plan, review, tests: [`specs/S1-learning-core/`](./specs/S1-learning-core/)

Scope: replace the placeholder learning schema with the real one for courses, paths, lessons, quizzes, exercises, enrolment, and progress, following F1.1, F1.2, F1.8, F1.11, F1.11a, F1.13 and `data-model.md`. No UI.

Deliverables

- Tables: `courses` (+ `estimated_hours`, `prerequisites`, `content_path`, `content_hash`, `completion_criteria`), `modules`, `lessons` (+ `completion_rule`, `mode`, `video_provider`, `video_id`, `content_path`, `content_hash`, `is_required`), `paths`, `path_courses`, `quizzes`, `questions`, `exercises`, `enrollments` (state model), `lesson_progress` (read model), `progress_events` (append-only, idempotency key), `content_revisions`.
- Drizzle relations for `db.query` usage; indexes on every foreign key and on `(user_id, subject)` lookups.
- A `progress` service in `packages/database` (or a new `packages/learning`): `recordEvent()` that inserts the event and updates read models in one transaction; `rebuildLearner(userId)` that recomputes from the stream.
- Seed updated with one path, one course, three lesson types, one quiz.

Acceptance criteria

- [x] Migration `0001_learning_core` applies on a fresh DB and on top of the current one.
- [x] Recording the same event twice (same idempotency key) leaves one row and unchanged read models.
- [x] Completing all required lessons flips `enrollments.status` to `completed` inside the same transaction.
- [x] `rebuildLearner` reproduces read models byte-for-byte from the stream (test compares before/after).
- [x] Integration tests cover the four points above against Postgres.

Depends on: S0.

### S2. Content pipeline: schema package, content repo, sync — `todo` (next)

Scope: option C in requirements area 3, phase 1 (F3.1, F3.2, F3.5, F3.6, N3.3). Creates the `devhelp-content` repo, the shared Zod schema, the content check, and the sync into Postgres.

Deliverables

- `packages/content-schema`: Zod schemas for course, module, lesson frontmatter, quiz, exercise, path, badge, company facts; exported types.
- `devhelp-content` repo (under the `devhelppk` org): layout per F3.1, two real courses' worth of placeholder lessons, `pnpm content:check` (frontmatter, links, quiz answers, exercise tests), CI, CC BY-SA license, contributor template.
- Platform: MDX compile step (`fumadocs-mdx` or `@content-collections/next`, pick one in the plan) consuming the content repo as a git dependency or submodule; `POST /api/content/sync` webhook (signed) that upserts metadata by slug, archives removed items, records `content_revisions`, and revalidates pages; `pnpm content:sync` for local use.

Acceptance criteria

- [ ] `content:check` fails on a bad quiz answer, a broken link, and a failing exercise test; passes on the sample content.
- [ ] Sync is idempotent: running twice produces no row changes; removing a lesson archives it and keeps its progress rows.
- [ ] A lesson body renders in the LMS from the compiled MDX with prose styles.
- [ ] Certificates-to-revision linkage is possible: each synced lesson row has a `content_revisions` entry with the commit SHA.

Depends on: S1.

### S3. LMS catalogue and lesson experience — `todo`

Scope: F1.1 to F1.4, F1.8, F1.9, F1.10, F1.12; N1.1; X10. Public catalogue, course page, path roadmap, lesson reader (article, video with completion, link), enrol, Continue, per-course progress UI. Uses the design system's app shell. Introduces `packages/api` (tRPC v11: `learning` router over `@repo/learning`, `catalogue` router over Drizzle reads), `@t3-oss/env-nextjs` in both apps, and `typedRoutes`.

Acceptance criteria

- [ ] Visitor can browse and read free lessons without an account; enrolling prompts sign-in.
- [ ] Video completion via player API records a `progress_events` row once.
- [ ] Continue lands on the first incomplete required lesson.
- [ ] Lesson page ships under 150 KB JS (measured in the build output) and renders at 360px with no horizontal scroll.
- [ ] Browser check in Chrome: catalogue, course, lesson, progress, light and dark.

Depends on: S2.

### S4. Quizzes and exercises — `todo`

Scope: F1.5, F1.6. Server-graded quizzes; Sandpack (web) and Pyodide (Python) exercises with CodeMirror 6; results recorded as events; completion rules `quiz_pass` and `exercise_pass`.

Acceptance criteria

- [ ] Correct answers never reach the client (checked via network tab and a test on the RSC payload).
- [ ] Quiz attempt stores the question version snapshot; regrading after a content change is possible.
- [ ] A passing Sandpack exercise records an event with the submitted code; a failing one does not complete the lesson.
- [ ] Pyodide loads only on Python exercises and is cached (second load is instant).

Depends on: S3.

### S5. Email, moderation core, notifications — `todo`

Scope: X1 (email provider), X2 (moderation queue, flags, audit log, policy page), X4 (in-app notifications). Better Auth email verification and organization invitations wired to the provider. Shared by S6, S7, S9, S10.

Acceptance criteria

- [ ] Verification and invitation emails send in dev via a local catcher (Mailpit in docker-compose) and in prod via Resend/Postmark (decide in plan).
- [ ] `moderation_items` supports any subject type; approve/reject/edit/merge actions are logged with actor and reason.
- [ ] Mentors see only their track's content items; admins see all.
- [ ] Notifications table with read state; in-app list in the app shell header.

Depends on: S1. Parallel-safe with S3/S4.

### S6. Ratings and course reviews — `todo`

Scope: area 4 phase 1 (F4.1, F4.2, F4.6, N4.2). Inline lesson rating with tags at completion; course reviews gated on 50 percent completion; aggregates on lessons and courses.

Acceptance criteria

- [ ] One rating per user per lesson, editable; aggregates recompute on write.
- [ ] Course review form only appears at ≥ 50 percent completion.
- [ ] Unclear-tag rate and average rating are queryable per lesson (feeds S11).

Depends on: S3.

### S7. Certificates and public profiles — `todo`

Scope: F1.18 to F1.20, X5. Issue on completion criteria, verify page, PDF with QR, revocation, opt-in public profile with certificates.

Acceptance criteria

- [ ] Certificate issues in the same transaction as course completion, with a criteria snapshot and `content_revision` reference.
- [ ] `/verify/[uuid]` is public, indexable, shows the snapshot, and says "revoked" with reason when revoked.
- [ ] PDF is generated server-side, cached in object storage (decide provider in plan), re-downloadable.
- [ ] Public profile shows name, city, certificates; private by default.

Depends on: S3, S5.

### S8. Projects, mentor review, badges, streaks — `todo`

Scope: F1.15, F1.16, F1.17, plus streak computation from `progress_events`. Project submission by repo URL, mentor review queue with structured feedback, badge rules evaluated on events, manual awards.

Acceptance criteria

- [ ] Submission status flow `submitted → changes_requested → accepted` with feedback visible to the learner.
- [ ] Badge rules defined in content repo (`badges/*.yaml`) evaluate against events; a "5 lessons in 7 days" badge awards exactly once.
- [ ] Streak and activity graph computed from events and shown on the dashboard and public profile.

Depends on: S4, S5, S7.

### S9. Cohorts: syllabus and org dashboards — `todo`

Scope: F1.21, F1.22. `cohort_courses`, cohort deadlines on learner dashboard, org staff aggregate view, per-learner view scoped to cohort membership.

Acceptance criteria

- [ ] Org owner creates a cohort, attaches ordered courses with dates, invites members (email via S5).
- [ ] Members see cohort deadlines; staff see percent complete per course and active learners this week.
- [ ] A staff member cannot see progress of a learner outside their cohorts (test).

Depends on: S3, S5.

### S10. Company bank — `todo`

Scope: area 2 phase 1 (F2.1 to F2.14, N2.1 to N2.3). Companies, reviews, interview experiences, salary aggregates per role with n ≥ 5, anonymisation, `verified`/`unverified` badge, moderation via S5, search, policy page, ISR company pages.

Acceptance criteria

- [ ] Public payloads and APIs contain no user ids or exact dates (test on serialisation).
- [ ] Salary cells with n < 5 fall back to the role aggregate or "not enough data".
- [ ] Reviews and interviews are invisible until approved; one review and one salary point per company per user.
- [ ] Company page is static-rendered and revalidates on approval.

Depends on: S5. Parallel-safe with S6–S9.

### S11. Mentor studio and dashboard — `todo`

Scope: area 3 phase 2 (F3.3, F3.7, F3.8, F3.9). Keystatic at `/studio` in GitHub mode for mentors; mentor application and role flip; dashboard with revision signals, project queue, moderation queue; attribution on lessons.

Acceptance criteria

- [ ] A mentor with no git knowledge edits a lesson in Studio and a PR appears on `devhelp-content`.
- [ ] Dashboard lists lessons below rating threshold or above unclear-tag rate (from S6).
- [ ] Contributors page and lesson attribution render from frontmatter.

Depends on: S2, S6, S8.

### S12. Comments and Q&A — `todo`

Scope: area 4 phase 2 (F4.3 to F4.5, N4.1, N4.3). Questions and replies under lessons, upvotes, accepted answers, notifications, moderation, no-index until moderated.

Acceptance criteria

- [ ] Comments load after the lesson body (streamed) and never block it.
- [ ] Accepted answer pins to top; author notified on replies.
- [ ] Links from new accounts are auto-held for moderation.

Depends on: S5, S6.

### S13. Company claims and cross-links — `todo`

Scope: area 2 phase 2 (F2.12, F2.15). Company representative claims, public responses, links between company pages and courses.

Depends on: S10, S3.

### S14. Search, analytics, launch hardening — `todo`

Scope: X3 (Postgres full-text search across courses, lessons, companies), X6 (Plausible/Umami), X8 (performance budget audit), X9 (fresh-clone run-through), security review of auth and moderation, CI including Postgres integration tests.

Acceptance criteria

- [ ] Fresh clone to running app in under 10 minutes following README only.
- [ ] `/security-review` findings addressed.
- [ ] Lighthouse mobile ≥ 90 on catalogue, lesson, company page.

Depends on: everything above.

---

## Backlog (post-launch, recorded so they are not forgotten)

- Offline tolerance for lesson pages and progress writes (F1.14).
- Alternative video providers (Mux, Cloudflare Stream).
- Peer review before mentor review on projects.
- Company-bank verification mechanics (work-email or document) and employer accounts / job openings.
- Email digests for notifications.
- Two-tier certificates ("completed" vs "verified with project") pending founder decision.

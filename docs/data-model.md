# devhelp data model (working draft)

Status: brainstorm, 2026-09-06. Identity and organizations are **implemented** (`packages/auth`, tables generated into `packages/database/src/schema/auth.ts`, integration-tested against Postgres). Learning entities are sketched so the identity layer leaves room for them.

## Principles

- **Identity is Better Auth's.** `users`, `sessions`, `accounts`, `verifications`, `organizations`, `members`, `invitations`, `teams`, `team_members` are generated from the auth config (`pnpm --filter @repo/auth auth:generate`) and edited only through `additionalFields`. Everything else is ours.
- **One `users` table.** Platform role (`student` / `mentor` / `admin`) lives on `users.role`, managed by the admin plugin. Organization role (`owner` / `admin` / `member`) lives on `members.role`. Do not add a third role concept.
- **UUID ids everywhere** (`generateId: "uuid"` in Better Auth, `uuid().defaultRandom()` in Drizzle) so any table can reference any other without type juggling.
- **snake_case in Postgres, camelCase in TypeScript** via Drizzle `casing`.
- **Progress is state, not a timestamp.** Every mature LMS (Moodle, Canvas, Open edX) stores item progress as a status plus a completion rule. Ours will too.
- **Free platform.** No commerce tables. Certificates and cohorts, yes; orders, no.

## What an "organization" means on devhelp

Better Auth's organization plugin gives us `organizations` with `members`, `invitations`, and optional `teams`. We map them to the real world like this:

| Better Auth                                     | devhelp meaning                                                                                                                              | Examples                                                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `organization` (`kind`)                         | An institution or community that groups learners                                                                                             | FAST Karachi CS society (`university`), Saylani batch provider (`bootcamp`), a hiring partner (`company`), a city meetup (`community`) |
| `member.role = owner/admin`                     | Staff of that institution: can invite, run cohorts, see aggregate progress of members                                                        | A society president, a bootcamp coordinator                                                                                            |
| `member.role = member`                          | A learner affiliated with the institution                                                                                                    | A student who joined via invite link                                                                                                   |
| `team` (`startsAt`, `endsAt`)                   | A **cohort / batch** inside the organization. Better Auth also auto-creates one default team named after the org; treat it as "all members". | "Fall 2026 AI Engineering cohort", "Batch 04"                                                                                          |
| `team_member`                                   | A learner enrolled in that cohort                                                                                                            |                                                                                                                                        |
| `session.activeOrganizationId` / `activeTeamId` | The context a learner is currently viewing the LMS in                                                                                        | Switching between "my university" and "devhelp community" views                                                                        |

Learners do not need an organization at all. The default experience is individual; organizations add cohort cadence, which the regional research shows drives completion (PIAIC, Saylani, Bano Qabil all run on batches).

Only `admin` and `mentor` platform roles can create organizations (`allowUserToCreateOrganization`). Students join by invitation or a join link.

## Entity map

```
users ──< sessions
users ──< accounts (oauth / password)
users ──< members >── organizations ──< teams ──< team_members >── users
                       organizations ──< invitations

users ──< enrollments >── courses ──< modules ──< lessons
users ──< lesson_progress >── lessons
users ──< quiz_attempts (S4) >── quizzes ──< questions
users ──< project_submissions >── lessons(type=project)  (planned)
users ──< certificates >── courses                       (S7)
paths ──< path_courses >── courses
teams ──< cohort_courses >── courses                     (planned: what a cohort is working through)
```

## Tables

### Identity (generated by Better Auth)

| Table           | Notable columns                                                                                               | Notes                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `users`         | `id, name, email, email_verified, image, role, banned, ban_reason, ban_expires, city, created_at, updated_at` | `role` default `student`. `city` is ours (additionalField).                                     |
| `sessions`      | `token, expires_at, ip_address, user_agent, active_organization_id, active_team_id, impersonated_by`          |                                                                                                 |
| `accounts`      | `provider_id, issuer, account_id, password, access_token, refresh_token, ...`                                 | Email/password lives here too (`provider_id = credential`). Unique on (`issuer`, `account_id`). |
| `verifications` | `identifier, value, expires_at`                                                                               | Email verification, password reset, magic links later.                                          |
| `organizations` | `name, slug, logo, metadata, kind, city, website`                                                             | `kind`, `city`, `website` are ours.                                                             |
| `members`       | `organization_id, user_id, role`                                                                              |                                                                                                 |
| `invitations`   | `organization_id, email, role, status, expires_at, inviter_id, team_id`                                       |                                                                                                 |
| `teams`         | `organization_id, name, starts_at, ends_at`                                                                   | Cohorts. `starts_at`/`ends_at` are ours.                                                        |
| `team_members`  | `team_id, user_id`                                                                                            |                                                                                                 |

### Learning (ours, implemented in S1)

Content metadata (owned by `@repo/content` sync from the `devhelppk/devhelp-content` repo; `content_revision_id` on courses, lessons, and paths records the commit that last changed the row; the currently deployed commit is the newest `content_revisions` row for the repo. The seed no longer creates courses):

| Table                   | Columns                                                                                                                                                                                                                                                         | Notes                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content_revisions`     | `repo, commit_sha, published_at, summary, item_count`                                                                                                                                                                                                           | One row per published content commit. Certificates will reference it.                                                                                                              |
| `courses`               | `slug, title, summary, description, track, level, cover_image_url, estimated_hours, is_published, published_at, archived_at, author_id, content_path, content_hash, content_revision_id, completion_criteria jsonb, rating_avg, rating_count, enrollment_count` | `completion_criteria` validated by `completionCriteriaSchema`. Rating columns reserved for S6.                                                                                     |
| `course_prerequisites`  | `course_id, prerequisite_id`                                                                                                                                                                                                                                    |                                                                                                                                                                                    |
| `modules`               | `course_id, slug, title, summary, position, archived_at`                                                                                                                                                                                                        | unique (course, slug)                                                                                                                                                              |
| `lessons`               | `module_id, course_id, slug, title, type, completion_rule, mode, is_required, is_free, duration_minutes, position, video_provider, video_id, content_path, content_hash, content_revision_id, archived_at, rating_avg, rating_count`                            | `type`: article, video, exercise, quiz, project, link. `completion_rule`: view, quiz_pass, exercise_pass, submit. `mode`: foundation, industry. Body comes from compiled MDX (S2). |
| `paths`, `path_courses` | `slug, title, summary, description, is_published, position` / `path_id, course_id, position`                                                                                                                                                                    | Ordered course groupings ("AI Engineering").                                                                                                                                       |
| `quizzes`               | `lesson_id (unique), pass_score, max_attempts, shuffle, version, content_hash`                                                                                                                                                                                  |                                                                                                                                                                                    |
| `questions`             | `quiz_id, position, type, prompt, options jsonb, answer jsonb, explanation, points, version`                                                                                                                                                                    | `options[].isCorrect` and `answer` are server-only; read through `questionPublicColumns` + `toPublicOptions`.                                                                      |
| `exercises`             | `lesson_id (unique), runner, language, starter_files jsonb, test_files jsonb, instructions, version, content_hash`                                                                                                                                              | runner: `browser` only (the in-house JS/TS runner; founder decision, end of S4; renamed from `sandpack` in migration 0005).                                                        |

Learner progress (owned by `@repo/learning`; never written directly):

| Table             | Columns                                                                                                                    | Notes                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `progress_events` | `user_id, kind, course_id, lesson_id, payload jsonb, idempotency_key (unique), occurred_at, recorded_at`                   | Append-only source of truth. Kinds: course_enrolled, course_completed, course_dropped, lesson_started, lesson_progressed, lesson_completed, quiz_attempted, exercise_submitted, project_submitted. |
| `enrollments`     | `user_id, course_id, status, progress_percent, last_lesson_id, team_id, enrolled_at, completed_at, dropped_at, updated_at` | Read model. status: active, completed, dropped. `team_id` = cohort.                                                                                                                                |
| `lesson_progress` | `user_id, lesson_id, course_id, status, progress_percent, last_position_seconds, started_at, completed_at, updated_at`     | Read model. status: not_started, in_progress, completed.                                                                                                                                           |

Rules: `recordEvent` inserts the event and updates read models in one transaction; duplicate idempotency keys are ignored; the first lesson event auto-enrols; completing the last required (non-archived) lesson emits `course_completed` under a row lock; `rebuildLearner` replays the stream and reproduces read models exactly, including `updated_at` (derived from `recorded_at`).

### Assessments (implemented in S4)

| Table                  | Columns                                                                                                                             | Notes                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quiz_attempts`        | `user_id, quiz_id, lesson_id, course_id, attempt, answers jsonb, snapshot jsonb, score, passed, quiz_version, submitted_at`         | Graded on the server. `snapshot` freezes each question's version, points, and result so regrading and history survive content changes. Unique (user, quiz, attempt). Best score per quiz feeds `completion_criteria.minQuizScore`. |
| `exercise_submissions` | `user_id, exercise_id, lesson_id, attempt, files jsonb, results jsonb, passed, runner, exercise_version, duration_ms, submitted_at` | Pass/fail computed in the learner's browser and recorded, not verified; the server rejects a `passed` claim that disagrees with `results`. Unique (user, exercise, attempt).                                                       |

Events: `quiz_attempted` (payload: attempt, score, passed, version) and `exercise_submitted` (attempt, passed, version, tests, failed) are recorded for every submission; a pass records `lesson_completed` with the enrolment generation key.

### Shared systems (implemented in S5)

| Table                | Key columns                                                                                                                                                                                   | Notes                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `moderation_items`   | `subject_type` (enum: mentor_application, company_review_request, …), `subject_id`, `status`, `track`, `submitted_by`, `decided_by`, `decided_at`, `reason`, `policy_clause`, `payload` jsonb | One queue for every area. Unique (subject_type, subject_id). `payload` is a snapshot validated by `moderationPayloadSchema`. `track` null = admin-only. |
| `moderation_actions` | `item_id`, `actor_id`, `action` (submit, approve, reject, edit, merge, hide, unhide, flag, dismiss_flag, request_review), `reason`, `policy_clause`, `before`, `after` jsonb                  | Append-only audit; written in the same transaction as every item change.                                                                                |
| `content_flags`      | `subject_type`, `subject_id`, `reporter_id`, `reason` (enum), `details`, `status` (open, upheld, dismissed), `item_id`                                                                        | One flag per reporter per subject.                                                                                                                      |
| `mentor_tracks`      | `user_id`, `track` (course_track), `granted_by`                                                                                                                                               | Which tracks a mentor moderates; admins moderate everything. Written when a mentor application is approved.                                             |
| `notifications`      | `user_id`, `kind` (enum), `subject_type`, `subject_id`, `title`, `body`, `href`, `dedupe_key`, `read_at`, `emailed_at`                                                                        | Written only by `@repo/notify`. Unique (user_id, dedupe_key).                                                                                           |
| `rate_limits`        | `key`, `count`, `window_started_at`                                                                                                                                                           | Fixed-window counters for per-user limits (mentor applications, verification resends, later reviews and comments).                                      |

### Area 4: feedback, reviews, discussions (implemented in S6)

| Table             | Key columns                                                                                                                                                                                                                                 | Notes                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lesson_feedback` | `user_id, lesson_id, course_id, rating (1–5), tags feedback_tag[], text`                                                                                                                                                                    | Private. PK (user, lesson). Drives `lessons.rating_avg`, `rating_count`, `unclear_count`.                                                                                   |
| `course_reviews`  | `user_id, course_id, rating, title, body, progress_at_review, completed_at_review, status (visible, hidden)`                                                                                                                                | Public, unique (user, course), written at ≥ 50 percent progress. Drives `courses.rating_avg`, `rating_count`, `review_count`.                                               |
| `comments`        | `subject_type (lesson, course), subject_id, course_id, parent_id, author_id, kind (question, note, answer), body, body_html, anchor, status (visible, held, hidden, deleted), vote_count, reply_count, accepted_at, accepted_by, edited_at` | One level deep. `body_html` is sanitised server output. `status = held` has a `comment` moderation item; `lessons.open_question_count` counts visible unanswered questions. |
| `comment_votes`   | `comment_id, user_id`                                                                                                                                                                                                                       | PK pair; `vote_count` kept in the same transaction.                                                                                                                         |
| `lesson_watchers` | `user_id, lesson_id`                                                                                                                                                                                                                        | Mentors notified of new questions (`lesson_question`).                                                                                                                      |

### Certificates and profiles (implemented in S7)

| Table          | Key columns                                                                                                                                                                                 | Notes                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `certificates` | `id` (verify uuid), `user_id, course_id, enrolment_generation, learner_name, course_title, content_revision_id, criteria jsonb, issued_at, revoked_at, revoked_reason, revoked_by, pdf_key` | Unique (user, course). Issued in the completion transaction; `criteria` validated by `certificateCriteriaSchema`; `pdf_key` points at object storage. Revocation logs a `certificate` moderation item. |
| `users` (+)    | `handle` (unique, nullable), `profile_public`, `bio`, `links` jsonb                                                                                                                         | Public profile (X5), opt-in, at `/u/<handle>`.                                                                                                                                                         |

### Badges and activity (implemented in S8)

| Table           | Key columns                                                                                                                                            | Notes                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `badges`        | `slug` (unique), `name`, `description`, `icon` (lucide), `rule` jsonb, `content_path`, `content_hash`, `content_revision_id`, `archived_at`            | Owned by the content sync like a course. `rule` is validated by `badgeRuleSchema` at the write boundary.                        |
| `user_badges`   | `user_id`, `badge_id`, `awarded_at`, `awarded_by` (null = automatic), `award_reason`, `trigger_event_id`, `revoked_at`, `revoked_reason`, `revoked_by` | PK on the pair, so an award is idempotent. Never deleted by a replay; revocation is a state and the row is its own audit trail. |
| `user_activity` | `user_id`, `day` (date, Asia/Karachi), `events`                                                                                                        | Read model for streaks and the activity grid; rebuilt by `rebuildLearner`.                                                      |

### Learning (planned; see `spec.md`)

- S9: `cohort_courses`. S10: company bank tables.

## Planned: the company bank (S10a)

A company is an organisation (`organizations.kind = "company"`), so an employer and an institution are one kind of row and a company claim (S13) is ordinary membership. `company_profiles` holds the facts a company page needs beyond name, slug, logo, city, and website; logos live in R2 through `@repo/storage`. Contributions (`company_reviews`, `interview_experiences`, `salary_points`) carry an author id for the one-per-company rule and moderation, and every public read goes through a column set that cannot select it. `company_stats` is a plain view over published contributions.

## Open questions

1. **Org-scoped content.** Should institutions be able to publish private courses? Leaning no for v1; all content is open and CC BY-SA. Organizations only add cohorts and visibility.
2. **Mentors.** Is `mentor` a platform role (can create orgs, review projects anywhere) or an org role? Currently platform. Revisit when project review exists.
3. **Email.** Settled in S5: Resend in production, Mailpit in development, through `@repo/email`.
4. **Learner privacy inside orgs.** What can an org admin see about a member's progress? Aggregate only by default; per-learner only inside a cohort the learner opted into.

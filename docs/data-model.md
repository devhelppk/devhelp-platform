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
users ──< quiz_attempts >── quizzes ──< questions        (planned)
users ──< project_submissions >── lessons(type=project)  (planned)
users ──< certificates >── courses                       (planned)
paths ──< path_courses >── courses                       (planned)
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

### Learning (ours, existing)

| Table             | Columns                                                                                     | Planned changes                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `courses`         | `slug, title, summary, description, track, level, cover_image_url, is_published, author_id` | add `organization_id` nullable (org-private courses later), `content_path` for MDX source                                              |
| `modules`         | `course_id, title, position`                                                                |                                                                                                                                        |
| `lessons`         | `module_id, slug, title, type, content, duration_minutes, position, is_free`                | add `completion_rule` (view / quiz_pass / submit), `video_provider`, `video_id`; `type` += `project`, `link`                           |
| `enrollments`     | `user_id, course_id, enrolled_at, completed_at`                                             | add `status` (active / completed / dropped), `progress_percent`, `last_lesson_id`, `team_id` (which cohort this enrollment belongs to) |
| `lesson_progress` | `user_id, lesson_id, completed_at`                                                          | add `status` (not_started / in_progress / completed), `progress_percent`, `last_position_seconds`, `started_at`, `updated_at`          |

### Learning (ours, planned; not built until content pipeline is decided)

- `quizzes`, `questions` (jsonb options, `version`), `quiz_attempts` (answers jsonb, score, passed, question version snapshot). Grade server-side.
- `exercise_submissions` (code, runner, test results jsonb, passed) for Sandpack / Pyodide exercises.
- `project_submissions` (repo_url, live_url, status, reviewer_id, feedback) for Odin-style projects.
- `certificates` (user_id, course_id, verify_uuid, issued_at, criteria_snapshot) with a public `/verify/[uuid]` page.
- `paths`, `path_courses` (ordered) for tracks like "AI Engineering Foundations".
- `cohort_courses` (team_id, course_id, starts_at, due_at) so a cohort has a syllabus.
- `progress_events` append-only (user_id, kind, subject_id, at) for streaks, analytics, and regrading.

## Open questions

1. **Org-scoped content.** Should institutions be able to publish private courses? Leaning no for v1; all content is open and CC BY-SA. Organizations only add cohorts and visibility.
2. **Mentors.** Is `mentor` a platform role (can create orgs, review projects anywhere) or an org role? Currently platform. Revisit when project review exists.
3. **Email.** Invitations and verification need an email sender before organizations are usable in production. Resend or Postmark; free tiers cover early volume.
4. **Learner privacy inside orgs.** What can an org admin see about a member's progress? Aggregate only by default; per-learner only inside a cohort the learner opted into.

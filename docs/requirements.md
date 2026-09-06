# devhelp features and requirements (working draft)

Status: draft v2, 2026-09-06 (founder review applied: everything below is MVP scope; no area is deferred). Written before finishing the data model so the schema serves the product, not the other way round. Each area lists user stories, requirements, an MVP cut, and the data-model hooks to resolve in `data-model.md`.

Scope note: the founder has confirmed all four areas are required for MVP. "Phase" labels below only order the build inside the MVP; nothing is deferred past launch.

## Actors

| Actor     | Who                                                                          | Platform role                          |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| Visitor   | Not signed in. Can read everything public.                                   | none                                   |
| Learner   | Signed-in student or engineer.                                               | `student`                              |
| Mentor    | Vetted contributor: writes lessons, reviews projects, verifies company info. | `mentor`                               |
| Org staff | Owner/admin of an organization (society, bootcamp, company). Runs cohorts.   | `student` or `mentor` + `members.role` |
| Admin     | devhelp team. Moderation, publishing, badges, certificates.                  | `admin`                                |

Cross-cutting principles (from the research and curriculum review): completion needs a mechanism (cohorts, deadlines, visible progress, an employer-facing signal); content is open (CC BY-SA 4.0) and lives in git; the audience is on mid-range Android phones and unreliable data, so every page must be fast and readable on a 360px screen; the UI is English; Urdu is not in scope.

---

## 1. Courses and lessons (LMS) with progress, badges, certificates

### Scope

The core product: structured courses made of modules and lessons, with tracked progress, exercises, and an outcome the learner can show an employer. Content is authored in the repo as MDX (see area 3) and published into the platform.

### User stories

- As a visitor I can browse the catalogue by track (technical / career), level, and path, and read any free lesson without an account, so the platform is useful before sign-up.
- As a learner I can enrol in a course, see what to do next, and resume exactly where I stopped, on any device.
- As a learner I complete lessons by the rule the lesson sets: read it, pass its quiz, submit an exercise that passes tests, or submit a project link.
- As a learner I can see my progress per course and across the platform, my streak, and the badges I have earned.
- As a learner who completes a course I receive a certificate with a public verification URL that I can put on LinkedIn and a CV.
- As an employer or recruiter I can open a certificate link and see what the learner actually did (criteria met, projects, dates), not just a PDF.
- As org staff I can create a cohort, attach a syllabus (courses with target dates), invite members, and see aggregate cohort progress.
- As a mentor I can review submitted projects in a queue and leave structured feedback.

### Functional requirements

**Catalogue and content**

- F1.1 Courses have slug, title, summary, description, track, level, cover, published flag, author(s), estimated hours, prerequisites (other courses), and a list of modules.
- F1.2 Lessons have a type: `article`, `video`, `exercise`, `quiz`, `project`, `link`. Each lesson declares its `completion_rule`: `view`, `quiz_pass`, `exercise_pass`, `submit`.
- F1.3 Lesson body is MDX rendered server-side with the design system's prose styles; code blocks get copy buttons and language labels; images are optimised.
- F1.4 Video lessons embed YouTube (unlisted) by default with completion tracked via the player API; provider is a field so Mux/Cloudflare can be added later.
- F1.5 Exercises run in the browser: Sandpack for web (HTML/CSS/JS/TS/React), Pyodide for Python, CodeMirror 6 as editor. Tests ship with the exercise; pass/fail is computed client-side and recorded server-side with the submitted code.
- F1.6 Quizzes support single-choice, multiple-choice, and short-answer; correct answers and explanations are stored server-side and graded in a server action; each question has per-option feedback.
- F1.8 Paths group courses in order (e.g. "AI Engineering Foundations") and show as a roadmap with the learner's position.
- F1.9 Each lesson and course has a "Foundation mode" / "Industry mode" flag from the curriculum: whether AI assistance is expected, and the lesson states it.

**Enrolment and progress**

- F1.10 Enrolling is one click; unenrolling keeps history.
- F1.11 Lesson progress is a state (`not_started`, `in_progress`, `completed`) with `progress_percent`, `last_position_seconds` for video, and timestamps. Course progress and `enrollments.status` are derived from lesson completion plus the course's completion criteria (default: all required lessons; optional: minimum quiz score, project accepted).
- F1.11a Implementation follows the pattern used by Open edX and Canvas at scale: an append-only `progress_events` stream is the source of truth; `lesson_progress` and `enrollments.progress_percent` are materialised read models updated transactionally on each event, with a rebuild job that can recompute any learner from the stream. Writes are idempotent (event key = user + subject + kind + client id) so retries and offline replays never double count.
- F1.12 "Continue" resolves to the first incomplete required lesson.
- F1.13 A `progress_events` append-only log records every completion, submission, and attempt. Streaks, activity graphs, and badges are computed from it, and it allows regrading.
- F1.14 Offline tolerance: lesson pages are cacheable; completion writes retry when the connection returns.

**Projects and review**

- F1.15 `project` lessons accept a GitHub repo URL and optional live URL. Submissions have a status: `submitted`, `changes_requested`, `accepted`. Mentors review from a queue; learners see feedback in place. Peer review is P1 (two peers plus rubric before a mentor).

**Badges**

- F1.16 Badges are defined in the repo (slug, name, description, icon, criteria as a rule: e.g. "complete 5 lessons in 7 days", "first accepted project", "finish path X"). Awarded automatically by evaluating rules against `progress_events`; admins can award manually.
- F1.17 Badges show on the learner's public profile if the learner makes the profile public.

**Certificates**

- F1.18 A certificate is issued when a course's completion criteria are met. It stores `verify_uuid`, issue date, the criteria snapshot (which lessons, quiz scores, accepted projects), and the learner's name at issue time.
- F1.19 `/verify/[uuid]` is public, indexable, and shows the criteria snapshot and links to accepted project repos.
- F1.19a A downloadable PDF is generated from the same record (server-rendered with the brand mark, the verify URL and a QR code printed on it) and cached in object storage; the learner can re-download it any time and share the verify link independently.
- F1.20 Certificates can be revoked by an admin with a reason; the verify page then says so.

**Cohorts (organizations)**

- F1.21 Org staff create a cohort (team) with dates and attach a syllabus: ordered courses with target dates. Members see cohort deadlines on their dashboard.
- F1.22 Org staff see aggregate progress (percent complete per course, active learners this week) and per-learner progress only for learners in the cohort.

### Non-functional

- N1.1 First lesson paint under 2 s on a mid-range Android over 3G; lesson pages under 150 KB of JS before exercise runners load on demand.
- N1.2 Every progress write is idempotent (unique on user + lesson) so retries never double-count.
- N1.3 Content changes deploy without a DB migration: MDX in git, a sync step upserts course/module/lesson rows by slug.

### Build phases (all MVP)

Phase 1: catalogue, article and video lessons, quizzes, enrolment, progress (event stream + read models), Continue, paths, certificates (verify page + PDF). Phase 2: Sandpack and Pyodide exercises, project submissions with mentor review, badges, streaks, public profiles, cohorts with syllabus and aggregate progress. Offline tolerance and alternative video providers are the only items that may land after launch.

### Data-model hooks

`courses` (+ `estimated_hours`, `prerequisites`, `content_path`, `completion_criteria` jsonb), `lessons` (+ `completion_rule`, `video_provider`, `video_id`, `mode`), `enrollments` (+ `status`, `progress_percent`, `last_lesson_id`, `team_id`), `lesson_progress` (state model), `quizzes`/`questions`/`quiz_attempts`, `exercise_submissions`, `project_submissions` + `project_reviews`, `badges` + `user_badges`, `certificates`, `paths` + `path_courses`, `cohort_courses`, `progress_events`.

---

## 2. Company information bank: reviews, interviews, salaries

### Scope

A community-contributed, Pakistan-focused reference on employers: what it is like to work there, how they interview, what they pay. The goal is orientation for a newcomer, not a rating war. Think Glassdoor's usefulness with Levels.fyi's structure and the trust model of a moderated wiki.

### User stories

- As a newcomer I can look up a company and get a one-screen overview: what they do, size, cities, tech stack, hiring seasons, typical roles, and how people describe the culture.
- As a job seeker I can read interview experiences for a specific role: rounds, question types, difficulty, outcome, timeline, and advice.
- As a job seeker I can see salary ranges by role, level, city, and years of experience, with sample size, so I can negotiate.
- As an employee or alumnus I can contribute a review, an interview experience, or a salary point anonymously, and my contribution is never traceable to my public profile.
- As a mentor I can mark a company profile as verified and correct facts (address, stack, hiring process) with sources.
- As a company representative I can claim a profile, respond publicly to reviews, and post current openings (P2).

### Functional requirements

**Companies**

- F2.1 Company profile: name, slug, logo, website, description, industry, size band, cities, founded, tech stack tags, hiring seasons, typical entry roles, links (careers page, LinkedIn). Aggregates: average rating, review count, interview difficulty distribution, salary summary per role.
- F2.2 Anyone signed in can propose a new company; it appears after a mentor or admin approves it (dedupe by name/domain).

**Reviews**

- F2.3 Review fields: overall rating (1 to 5), sub-ratings (learning, management, work-life balance, compensation, growth), role, employment status (current / former / intern), tenure band, city, pros, cons, advice, would-recommend. Author is anonymous publicly; stored internally for moderation and one-review-per-company-per-user.
- F2.3a Every review, interview experience, and salary point is anonymised in all public and API output (no user id, name, or exact dates; dates rounded to month) and carries a `verified` / `unverified` badge. At launch everything is `unverified`; verification (work-email or document check, Glassdoor-style) is a later feature but the field, the badge, and the audit trail exist from day one so nothing needs re-modelling.
- F2.4 Reviews go through a moderation queue before publishing (see moderation below). Published reviews can be flagged by readers.

**Interviews**

- F2.5 Interview experience: role, level, year/month, source (referral, job board, campus), rounds (list of type + description), difficulty (1 to 5), duration, outcome (offer / rejected / withdrew / no response), questions asked (free text, optional), advice. Same anonymity and moderation as reviews.

**Salaries**

- F2.6 Salary point: role, level, years of experience, city, employment type, base per month in PKR, bonus/equity flags, year, remote/on-site. Displayed **only as aggregates per role** (median, p25 to p75, n) with optional level and city breakdowns when each cell has n ≥ 5; below that, show the role-level aggregate or "not enough data". Individual points are never shown or exportable.
- F2.7 Foreign-employer salaries in USD are supported (remote work is common); display converts with a stored rate and shows both.

**Trust and moderation**

- F2.8 Contributions require a verified email; contributions from `.edu.pk` or a company-domain email can carry a "verified affiliation" mark without revealing the address.
- F2.9 Moderation queue for admins and mentors: approve, reject with reason, edit for policy (remove names of individuals, defamation), merge duplicate companies. Every action is logged.
- F2.10 Content policy is enforced: no naming individuals, no unverifiable accusations, no salaries claimed on behalf of others. Rejections show the policy clause.
- F2.11 Rate limits: one review and one salary point per company per user; interview experiences limited per month.
- F2.12 Companies can request review of a specific post; the request and outcome are logged and visible to admins.

**Discovery**

- F2.13 Search and filter companies by city, industry, stack, size, rating, and "hires juniors". Sort by review count and recency.
- F2.14 Company pages are public and indexable; they are the main SEO entry point for the platform.
- F2.15 Link from a company page to relevant courses ("this company interviews on X; learn X here"), and from lessons to "companies that ask this".

### Non-functional

- N2.1 Legal exposure: defamation risk is real in Pakistan; moderation before publish is mandatory for reviews and interviews, and the policy plus a takedown contact are published.
- N2.2 Anonymity: public payloads never include user ids; internal linkage lives in a separate column set readable only by admins; exports strip it.
- N2.3 Aggregates are computed in the database (materialised view refreshed on write) so company pages stay cheap.

### Build phases (all MVP)

Phase 1: company profiles (proposed and approved), reviews, interview experiences, salary aggregates per role with the n ≥ 5 rule, anonymisation, `verified`/`unverified` badge (all unverified at launch), moderation queue, search, content policy page. Phase 2: company claims and public responses, cross-links to courses. Verification mechanics and job openings come after launch.

### Data-model hooks

`companies`, `company_aliases`, `company_reviews`, `interview_experiences` (+ `interview_rounds` jsonb), `salary_points`, `company_claims`, `moderation_items` (polymorphic: subject type + id, status, moderator, reason), `content_flags`, `company_stats` (materialised view). Roles tags and cities as reference tables shared with the LMS (`cities`, `job_roles`).

---

## 3. Mentor contribution workflow

### Scope

How lessons, courses, quizzes, exercises, and company facts get written, reviewed, and published, and how learner-facing signals route back to mentors. The founder asked for a researched proposal on where content lives: MDX in the platform repo, MDX in a separate repo, or content in Postgres behind a mentor platform.

### Options considered (verified 2026-09-06)

| Option                                      | How it works                                                                                                                                                                                                                                                                              | Fits                                                                                                                                                            | Costs                                                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. MDX in the platform repo                 | Lessons in `content/` next to app code; mentors open PRs; build compiles MDX (`fumadocs-mdx` 15.x, supports Next 16).                                                                                                                                                                     | Zero infra, full history, PR review, previews for free. This is how freeCodeCamp and The Odin Project run at 450k / 13k stars.                                  | Mentors must use git; app and content PRs share one queue and one CI; content churn triggers app builds.                                                                                                       |
| B. MDX in a separate `devhelp-content` repo | Same as A, but the content repo is the source of truth and the platform consumes it (build-time submodule/package, or runtime fetch with on-demand revalidation).                                                                                                                         | Keeps mentor PRs away from app code; content can have its own reviewers, CI, and release cadence; the repo itself is a public, forkable curriculum.             | One sync hop; two repos to keep in step; still git-only unless paired with an editor (see C).                                                                                                                  |
| C. B + a git-backed editor UI               | Keystatic (MIT, Thinkmill, `@keystatic/next` 5.x, Next ≥14) mounted in the LMS at `/studio`, in GitHub mode: mentors edit MDX and structured fields in a browser; Keystatic writes to a branch and opens a PR. Decap (MIT, 19k stars) and TinaCMS (Apache-2.0, 13k) are the alternatives. | Non-git mentors get a form-based editor; git-fluent mentors keep PRs; content stays plain MDX + YAML so the editor is replaceable; one migration system (ours). | Keystatic is small (2.3k stars, 0.6.x) but actively maintained and backed by a consultancy; its schema must mirror our Zod content schema.                                                                     |
| D. Content in Postgres via a CMS            | Payload CMS 3.88 (MIT, 44k stars, runs inside Next 16, stores in Postgres through its own Drizzle layer) with drafts, versions, access control, live preview. Mentors edit in-browser; publish is instant. This is the Coursera/Udemy model.                                              | No git at all; structured fields for quizzes and exercises; instant publish and rollback.                                                                       | Second migration system in the same database; content is no longer a public git curriculum (contribution by PR disappears); exercises with test code and previews fit less naturally; heavy dependency to own. |

### Proposal: option C

Content is a public git repository, edited through PRs or a browser editor that produces PRs. Runtime data stays in Postgres. Concretely:

- F3.1 `devhelp-content` repo: `courses/<course>/course.yaml`, `courses/<course>/<module>/<lesson>.mdx` with YAML frontmatter, `quizzes/*.yaml`, `exercises/<slug>/{README.mdx, starter/, tests/}`, `paths/*.yaml`, `badges/*.yaml`, `companies/*.yaml` (verified facts only; reviews and salaries are user data and live in Postgres). A Zod schema package (`@repo/content-schema`) is shared by the content repo's CI and the platform.
- F3.2 `pnpm content:check` in the content repo lints frontmatter, links, images, quiz answers, exercise tests (runs them), and the style guide. Required on every PR.
- F3.3 Keystatic mounted at `learn.devhelp.pk/studio` in GitHub mode, restricted to `mentor` and `admin` roles, with collections mirroring the Zod schema. Saving creates a branch and a PR on `devhelp-content`; the mentor never touches git. Git-fluent mentors bypass it.
- F3.4 Review: `CODEOWNERS` maps tracks to editor mentors; a PR needs one editor approval and one mentor review; PR preview deploy renders changed lessons with the real design system.
- F3.5 Publish (as built in S2): the platform pins a content commit in `content.lock.json`; on merge to the content repo a workflow opens a lock-bump PR on the platform. Deploying the platform pulls that commit, compiles lesson bodies with Content Collections, and runs `content:sync`, which upserts course/module/lesson/quiz/exercise/path metadata by slug, archives removed items so progress history survives, and records the commit in `content_revisions`. `POST /api/content/sync` re-runs the sync for the deployed content (recovery only).
- F3.6 `content_revisions` records which content commit published which lesson version; certificates reference the revision so "what did this course require at issue time" is answerable.
- F3.7 Mentor onboarding: application form, admin approval flips the role, adds the mentor to the public contributors page, and grants Studio access.
- F3.8 Mentor dashboard in the LMS: open content issues (GitHub API), lessons needing revision (rating below threshold, unclear-tag rate, drop-off, unresolved questions), project review queue, company moderation queue.
- F3.9 Attribution on every lesson (authors, reviewers) from frontmatter, plus contributor stats.
- F3.10 Exit path: if in-browser editing ever needs to be instant and structured beyond what git can do, the content package boundary (`@repo/content-schema` + sync webhook) is where Payload would slot in; nothing else changes.

### Why not D now

Everything in area 1 (quizzes with server-side answers, exercises with tests, certificates tied to a content version) benefits from content being versioned text with CI. The mission benefits from the curriculum being a forkable public repo. Option C gives non-git mentors a form editor without giving up either. Option D is the right call only if mentors need to publish without any review step, which contradicts F3.4.

### Non-functional

- N3.1 Everything a mentor needs runs locally with `pnpm dev`; Keystatic also works in local mode against a checkout.
- N3.2 Content license CC BY-SA 4.0 asserted in the content repo and on every lesson; contributors accept it in the PR template.
- N3.3 Content sync is idempotent and safe to replay; a full resync from the content repo must rebuild all metadata rows without touching learner data.

### Build phases (all MVP)

Phase 1: content repo with schema and `content:check`, PR review with previews, sync webhook, attribution, mentor application. Phase 2: Keystatic studio, mentor dashboard with revision signals.

### Data-model hooks

`mentor_applications`, `content_revisions`, `lesson_authors`; content metadata tables (`courses`, `modules`, `lessons`, `quizzes`, `questions`, `exercises`, `paths`, `badges`, `companies` facts) are owned by the sync and carry `content_path` + `content_hash`.

---

## 4. Comments, ratings, and feedback on lessons and courses

### Scope

Lightweight signals that improve content and help learners help each other, without turning the platform into a forum we cannot moderate.

### User stories

- As a learner I can rate a lesson as I complete it (thumbs or 1 to 5 plus optional "what was unclear") in two taps.
- As a learner I can ask a question or leave a note under a lesson, see others' questions, and upvote the ones I share.
- As a mentor I can answer a question and mark it as the accepted answer; accepted answers show at the top and can be promoted into the lesson.
- As a learner I can rate a course at completion with a short review that appears on the course page.
- As an admin I can see a lesson's rating trend, unclear-flags, and unresolved questions, and route them to mentors (area 3).

### Functional requirements

- F4.1 Lesson feedback: rating (1 to 5), optional tags (`unclear`, `too_long`, `outdated`, `error`, `loved_it`), optional text. One per user per lesson, editable. Captured inline at the completion moment.
- F4.2 Course reviews: rating plus text, only from learners with ≥ 50 percent completion; shown on the course page with completion badge.
- F4.3 Lesson comments: threaded one level deep (question and replies), Markdown subset, code blocks, upvotes, "accepted answer" by mentors, sort by accepted then votes then recency. Anchored to a lesson, optionally to a heading.
- F4.4 Notifications: author of a question is notified on replies; mentors watching a lesson are notified on new questions (in-app first, email digest P1).
- F4.5 Moderation shares the queue and flag model from area 2: readers flag, mentors and admins hide or delete, actions logged. Automatic holds for links from new accounts.
- F4.6 Aggregates per lesson and course: average rating, rating count, unclear-tag rate, open-question count. These drive the mentor revision list.
- F4.7 Everything here is optional for the learner and never blocks completion.

### Non-functional

- N4.1 Comments load after the lesson body and never delay it.
- N4.2 Ratings are idempotent per user + subject; aggregates are recomputed on write.
- N4.3 Comments are indexed for search within a course but are `noindex` for external search until moderated.

### Build phases (all MVP)

Phase 1: lesson ratings with tags, course reviews, per-lesson and per-course aggregates. Phase 2: comments (questions and replies, upvotes, accepted answers), notifications, moderation hooks. Both ship for launch; ratings first so the revision signal exists while comments are being built.

### Data-model hooks

`lesson_feedback`, `course_reviews`, `comments` (polymorphic subject, parent_id, accepted flag), `comment_votes`, `notifications`, reuse `moderation_items` and `content_flags` from area 2. Aggregates as columns on `lessons`/`courses` updated by trigger or on write.

---

## Cross-cutting requirements

- X1 **Identity and organizations** as built: Better Auth, platform roles, organizations with cohorts. Email verification is required before contributing to areas 2 and 4; an email provider (Resend or Postmark) is therefore required for launch.
- X2 **Moderation** is one system used by areas 2, 3, and 4: a queue, a flag model, a policy page, an audit log, and role-based access (mentor can approve content in their track; admin can do everything).
- X3 **Search** across courses, lessons, companies, and (later) comments. Start with Postgres full-text search; move to Typesense/Meilisearch if needed.
- X4 **Notifications** in-app with an email digest; a single `notifications` table with type, subject, read state.
- X5 **Public profiles** (opt-in): name, city, badges, certificates, accepted projects, contributions. The employer-facing signal from the curriculum review lives here.
- X6 **Analytics** privacy-preserving (Plausible or Umami self-hosted): lesson drop-off, completion funnels, search terms. No third-party ad trackers.
- X7 **Accessibility**: WCAG AA, keyboard and screen-reader paths. English-only UI; dates and currency formatted for Pakistan (PKR, DD Mon YYYY).
- X8 **Performance budget** as in N1.1; the company bank and catalogue are static-rendered with ISR; progress and comments are dynamic islands.
- X10 **End-to-end type safety** (founder requirement): one type flows from the Postgres column to the React prop with no hand-written duplicates. Concretely: Drizzle inferred row types are the only entity types; every `jsonb` column has a Zod schema in `packages/database/src/schema/json.ts` and its TS type is inferred from that schema; every write boundary (server actions, sync webhook, seed, `@repo/learning`) validates with Zod; the API layer is tRPC v11 (`packages/api`) so client hooks and server callers share router types, with React Query on the client and direct callers in RSC; Next `typedRoutes` for links; env validated at boot with `@t3-oss/env-nextjs`; `strict` TypeScript with `noUncheckedIndexedAccess` everywhere; no `any` and no `as` casts outside test helpers (ESLint enforced). Better Auth's `$Infer` types are the session types.
- X9 **Open source**: MIT code, CC BY-SA content, public roadmap, contribution guide, and the platform must run end to end on a laptop with Docker and no paid keys.

## Build order (everything ships for launch)

1. Content repo, schema, sync (area 3 phase 1) and LMS phase 1 (area 1) with lesson ratings (area 4 phase 1). This is the product.
2. Email provider, moderation system, public profiles (X1, X2, X5).
3. Company bank phase 1 (area 2). It is the SEO and acquisition engine and needs the moderation system.
4. Exercises, projects and review, badges, cohorts (area 1 phase 2); comments (area 4 phase 2); Keystatic studio and mentor dashboard (area 3 phase 2); company claims (area 2 phase 2).

## Decisions recorded (founder, 2026-09-06)

- Certificates are verifiable pages **and** downloadable PDFs.
- Progress follows the event-stream + materialised read model pattern (F1.11a).
- Salaries are aggregates per role only; all company-bank submissions are anonymised and carry a `verified` / `unverified` badge; verification mechanics come later, the model exists now.
- Mentor contributions: option C above (public content repo, PR review, Keystatic studio for non-git mentors, sync to Postgres).
- All four areas are MVP; nothing is deferred past launch.
- No Urdu summaries or Urdu UI.

## Open questions for the founder

1. Should certificates require an accepted project, or is quiz completion enough for a first tier? Two tiers ("completed" vs "verified with project") is an option.
2. Who moderates on day one? Reviews, interviews, comments, and content PRs all need humans; the moderation queue is built for it, but staffing decides throughput.
3. Content repo name and org: `devhelppk/devhelp-content` under the existing GitHub org?

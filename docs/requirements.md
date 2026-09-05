# devhelp features and requirements (working draft)

Status: draft v1, 2026-09-06. Written before finishing the data model so the schema serves the product, not the other way round. Each area lists user stories, requirements, an MVP cut, and the data-model hooks to resolve in `data-model.md`.

Priority labels: **P0** = must exist for launch, **P1** = first quarter after launch, **P2** = later. "Later" items are still specified so P0 choices do not paint us into a corner.

## Actors

| Actor     | Who                                                                          | Platform role                          |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| Visitor   | Not signed in. Can read everything public.                                   | none                                   |
| Learner   | Signed-in student or engineer.                                               | `student`                              |
| Mentor    | Vetted contributor: writes lessons, reviews projects, verifies company info. | `mentor`                               |
| Org staff | Owner/admin of an organization (society, bootcamp, company). Runs cohorts.   | `student` or `mentor` + `members.role` |
| Admin     | devhelp team. Moderation, publishing, badges, certificates.                  | `admin`                                |

Cross-cutting principles (from the research and curriculum review): completion needs a mechanism (cohorts, deadlines, visible progress, an employer-facing signal); content is open (CC BY-SA 4.0) and lives in git; the audience is on mid-range Android phones and unreliable data, so every page must be fast and readable on a 360px screen; Roman-Urdu and Urdu summaries are a first-class content field, not an afterthought.

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
- F1.7 Every lesson has optional `summary_ur` (Urdu) and `summary_roman_ur` fields shown as a collapsible "Khulasa" block.
- F1.8 Paths group courses in order (e.g. "AI Engineering Foundations") and show as a roadmap with the learner's position.
- F1.9 Each lesson and course has a "Foundation mode" / "Industry mode" flag from the curriculum: whether AI assistance is expected, and the lesson states it.

**Enrolment and progress**

- F1.10 Enrolling is one click; unenrolling keeps history.
- F1.11 Lesson progress is a state (`not_started`, `in_progress`, `completed`) with `progress_percent`, `last_position_seconds` for video, and timestamps. Course progress and `enrollments.status` are derived from lesson completion plus the course's completion criteria (default: all required lessons; optional: minimum quiz score, project accepted).
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
- F1.19 `/verify/[uuid]` is public, indexable, and shows the criteria snapshot and links to accepted project repos. The PDF/PNG is generated from the same data with the brand mark.
- F1.20 Certificates can be revoked by an admin with a reason; the verify page then says so.

**Cohorts (organizations)**

- F1.21 Org staff create a cohort (team) with dates and attach a syllabus: ordered courses with target dates. Members see cohort deadlines on their dashboard.
- F1.22 Org staff see aggregate progress (percent complete per course, active learners this week) and per-learner progress only for learners in the cohort.

### Non-functional

- N1.1 First lesson paint under 2 s on a mid-range Android over 3G; lesson pages under 150 KB of JS before exercise runners load on demand.
- N1.2 Every progress write is idempotent (unique on user + lesson) so retries never double-count.
- N1.3 Content changes deploy without a DB migration: MDX in git, a sync step upserts course/module/lesson rows by slug.
- N1.4 All learner-facing text has an Urdu translation path (next-intl or equivalent) even if v1 ships English only.

### MVP cut (P0)

Catalogue, article and video lessons, quizzes, enrolment, lesson/course progress, Continue, progress events, one path, certificates with verify page, Urdu summaries. Exercises with Sandpack (web only). Cohorts with syllabus and aggregate progress.

P1: Pyodide exercises, project submissions with mentor review, badges, streaks, public profiles, peer review.
P2: offline tolerance, Mux/Cloudflare video, Urdu UI.

### Data-model hooks

`courses` (+ `estimated_hours`, `prerequisites`, `content_path`, `completion_criteria` jsonb), `lessons` (+ `completion_rule`, `video_provider`, `video_id`, `summary_ur`, `summary_roman_ur`, `mode`), `enrollments` (+ `status`, `progress_percent`, `last_lesson_id`, `team_id`), `lesson_progress` (state model), `quizzes`/`questions`/`quiz_attempts`, `exercise_submissions`, `project_submissions` + `project_reviews`, `badges` + `user_badges`, `certificates`, `paths` + `path_courses`, `cohort_courses`, `progress_events`.

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
- F2.4 Reviews go through a moderation queue before publishing (see moderation below). Published reviews can be flagged by readers.

**Interviews**

- F2.5 Interview experience: role, level, year/month, source (referral, job board, campus), rounds (list of type + description), difficulty (1 to 5), duration, outcome (offer / rejected / withdrew / no response), questions asked (free text, optional), advice. Same anonymity and moderation as reviews.

**Salaries**

- F2.6 Salary point: role, level, years of experience, city, employment type, base per month in PKR, bonus/equity flags, year, remote/on-site. Displayed only as aggregates with n ≥ 5 per cell (role + level or role + city); below that, show a wider band or "not enough data". Never show individual points.
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

### MVP cut (P0)

Company profiles (proposed and approved), reviews with moderation, interview experiences, salary aggregates with the n ≥ 5 rule, search, and the content policy page.

P1: verified affiliation marks, company claims and responses, cross-links to courses.
P2: openings, employer accounts.

### Data-model hooks

`companies`, `company_aliases`, `company_reviews`, `interview_experiences` (+ `interview_rounds` jsonb), `salary_points`, `company_claims`, `moderation_items` (polymorphic: subject type + id, status, moderator, reason), `content_flags`, `company_stats` (materialised view). Roles tags and cities as reference tables shared with the LMS (`cities`, `job_roles`).

---

## 3. Mentor contribution workflow

### Scope

How lessons, courses, quizzes, and company facts get written, reviewed, and published, mostly through git, with the platform providing the human workflow around it. Content is code; the platform is the editor's assistant, not the editor.

### User stories

- As a prospective mentor I can apply with my background and a sample; a devhelp admin approves me and I get the `mentor` role and a place in the contributors list.
- As a mentor I can pick up an open content task (an issue), write a lesson in MDX using a template, preview it locally and in a PR preview, and get it reviewed by another mentor and an editor before it ships.
- As a mentor I can see which lessons have low ratings, high drop-off, or open comments, and claim them for revision.
- As a mentor I review learner project submissions from a queue (area 1) and verify company facts (area 2).
- As an admin I can see contributor activity and credit mentors on lessons and on the site.

### Functional requirements

- F3.1 Content lives in `content/` in the platform repo (or a sibling `devhelp-content` repo if it outgrows it) as MDX with frontmatter validated by a Zod schema at build time: slug, title, type, duration, mode, completion rule, quiz/exercise spec, `summary_ur`, authors, reviewers, `updated`.
- F3.2 A `pnpm content:check` command lints frontmatter, links, images, quiz answers, exercise tests, and the style guide (adapted from The Odin Project's template and freeCodeCamp's challenge format).
- F3.3 PR previews (Vercel or equivalent) render changed lessons with the real design system.
- F3.4 A `CODEOWNERS`-style map assigns tracks to editor mentors; a PR needs one editor approval plus one mentor review.
- F3.5 A sync step upserts published content into Postgres by slug on deploy; deleting a lesson archives rather than deletes rows so progress history survives.
- F3.6 Mentor application form on the site; approval flips the platform role and adds the mentor to the public contributors page with bio and links.
- F3.7 Mentor dashboard: open content issues (pulled from GitHub), lessons needing revision (rating below threshold, drop-off above threshold, unresolved comments), project review queue, company moderation queue.
- F3.8 Attribution: lesson pages show authors and reviewers with links; contributor stats feed a "top contributors" section.
- F3.9 Non-git path (P1): an in-browser MDX editor that opens a PR on the contributor's behalf via the GitHub API, for mentors who are not comfortable with git.

### Non-functional

- N3.1 Everything a mentor needs to write and preview runs locally with `pnpm dev`; no paid services required.
- N3.2 Content license CC BY-SA 4.0 is asserted in the repo and on every lesson; contributors agree on their first PR (CLA-lite via a checkbox in the PR template).

### MVP cut (P0)

MDX content directory with schema and `content:check`, PR-based review with previews, sync-to-DB on deploy, mentor application and role flip, attribution on lessons.

P1: mentor dashboard with revision signals, in-browser editor that opens PRs.

### Data-model hooks

`mentor_applications`, `content_revisions` (which git commit published which lesson version; needed for "what did this certificate's course look like at issue time"), `lesson_authors` (user + role: author / reviewer / translator). Most of the workflow state stays in GitHub; the DB only mirrors what the product needs to display.

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

### MVP cut (P0)

Lesson ratings with tags, course reviews, per-lesson aggregates. Comments (questions and replies, upvotes, accepted answers) are **P1** because they need moderation staffing; ship ratings first and gather the signal.

### Data-model hooks

`lesson_feedback`, `course_reviews`, `comments` (polymorphic subject, parent_id, accepted flag), `comment_votes`, `notifications`, reuse `moderation_items` and `content_flags` from area 2. Aggregates as columns on `lessons`/`courses` updated by trigger or on write.

---

## Cross-cutting requirements

- X1 **Identity and organizations** as built: Better Auth, platform roles, organizations with cohorts. Email verification is required before contributing to areas 2 and 4; an email provider (Resend or Postmark) is therefore P0 for those areas.
- X2 **Moderation** is one system used by areas 2, 3, and 4: a queue, a flag model, a policy page, an audit log, and role-based access (mentor can approve content in their track; admin can do everything).
- X3 **Search** across courses, lessons, companies, and (later) comments. Start with Postgres full-text search; move to Typesense/Meilisearch if needed.
- X4 **Notifications** in-app with an email digest; a single `notifications` table with type, subject, read state.
- X5 **Public profiles** (opt-in): name, city, badges, certificates, accepted projects, contributions. The employer-facing signal from the curriculum review lives here.
- X6 **Analytics** privacy-preserving (Plausible or Umami self-hosted): lesson drop-off, completion funnels, search terms. No third-party ad trackers.
- X7 **Accessibility and localisation**: WCAG AA, keyboard and screen-reader paths, RTL-ready layout for Urdu, all dates and numbers localised.
- X8 **Performance budget** as in N1.1; the company bank and catalogue are static-rendered with ISR; progress and comments are dynamic islands.
- X9 **Open source**: MIT code, CC BY-SA content, public roadmap, contribution guide, and the platform must run end to end on a laptop with Docker and no paid keys.

## Suggested build order

1. LMS P0 (area 1) with ratings (area 4 P0) and the content pipeline (area 3 P0). This is the product.
2. Email provider, moderation system, public profiles (X1, X2, X5).
3. Company bank P0 (area 2). It is the SEO and acquisition engine and benefits from the moderation system existing.
4. Comments, badges, mentor dashboard, peer review (P1 across areas).

## Open questions for the founder

1. Are company reviews and salaries a launch feature or a second act? They bring legal and moderation load early but also traffic.
2. Should certificates require an accepted project, or is quiz completion enough for a first tier? (Two tiers: "completed" vs "verified with project" is an option.)
3. Who moderates on day one? If it is one person, the P0 cut for areas 2 and 4 should be smaller.
4. Is the content repo the platform repo or a separate one? Separate keeps mentor PRs away from app code but adds a sync hop.

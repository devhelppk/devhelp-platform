# devhelp spec tracker

One spec at a time: **plan → implement → review → test → complete**. A spec is complete only when every acceptance criterion is met, `pnpm format && pnpm lint && pnpm check-types && pnpm test && pnpm build` pass, and the change is committed. Nothing starts until the previous spec is complete, unless marked parallel-safe.

Source documents: `requirements.md` (what and why), `data-model.md` (schema decisions). Requirement ids (F1.11, X2, …) refer to `requirements.md`.

Each spec gets its own directory under `docs/specs/<id>-<slug>/` holding `plan.md` (written in the plan step, approved before implementation) and, as the work proceeds, `review.md` (code-review findings and what was done about them) and `test.md` (what was tested, how, and the results). The spec's entry here links to that directory and carries the status.

## Browser loop (applies to every spec that touches UI)

Automated tests are not enough for UI. Before a UI spec can be marked complete:

1. Start the dev server (`pnpm dev:lms` or `pnpm dev:web`) against the local Postgres with real synced content.
2. Drive the new screens in Chrome with the browser tools: every route the spec adds or changes, every state (signed out, signed in, empty, error), light and dark, desktop and a 390px viewport.
3. Critique against the design system (`packages/ui/DESIGN.md`) and the acceptance criteria; fix; reload; repeat until nothing is left to fix. At least two iterations are expected; record what each round found and changed.
4. Check the console is clean on every load and that no page scrolls horizontally on mobile.
5. Save the final screenshots (desktop and mobile, light and dark) and list them in `test.md` with the iteration log.

The plan for a UI spec must name the routes and states the loop will cover.

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
4. **Test.** Unit tests for logic, integration tests against Postgres where data is involved. **Every spec that touches UI must also pass the browser loop** (below). All existing tests still pass. Summarise in `test.md`.
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

### S2. Content pipeline: schema package, content repo, sync — `done` (`c3c3c07`)

Plan, review, tests: [`specs/S2-content-pipeline/`](./specs/S2-content-pipeline/)

Scope: option C in requirements area 3, phase 1 (F3.1, F3.2, F3.5, F3.6, N3.3). Creates the `devhelp-content` repo, the shared Zod schema, the content check, and the sync into Postgres.

Deliverables

- `packages/content-schema`: Zod schemas for course, module, lesson frontmatter, quiz, exercise, path, badge, company facts; exported types.
- `devhelp-content` repo (under the `devhelppk` org): layout per F3.1, two real courses' worth of placeholder lessons, `pnpm content:check` (frontmatter, links, quiz answers, exercise tests), CI, CC BY-SA license, contributor template.
- Platform: MDX compile step (`fumadocs-mdx` or `@content-collections/next`, pick one in the plan) consuming the content repo as a git dependency or submodule; `POST /api/content/sync` webhook (signed) that upserts metadata by slug, archives removed items, records `content_revisions`, and revalidates pages; `pnpm content:sync` for local use.

Acceptance criteria

- [x] `content:check` fails on a bad quiz answer, a broken link, and a failing exercise test; passes on the sample content.
- [x] Sync is idempotent: running twice produces no row changes; removing a lesson archives it and keeps its progress rows.
- [x] A lesson body renders in the LMS from the compiled MDX with prose styles.
- [x] Certificates-to-revision linkage is possible: each synced lesson row has a `content_revisions` entry with the commit SHA.

Depends on: S1.

### S3. LMS catalogue and lesson experience — `done` (`1007fd6`)

Plan, review, tests, screenshots: [`specs/S3-lms-experience/`](./specs/S3-lms-experience/)

Scope: F1.1 to F1.4, F1.8, F1.9, F1.10, F1.12; N1.1; X10. Public catalogue, course page, path roadmap, lesson reader (article, video with completion, link), enrol, Continue, per-course progress UI. Uses the design system's app shell. Introduces `packages/api` (tRPC v11: `learning` router over `@repo/learning`, `catalogue` router over Drizzle reads), `@t3-oss/env-nextjs` in both apps, and `typedRoutes`.

Acceptance criteria

- [x] Visitor can browse and read free lessons without an account; enrolling prompts sign-in.
- [x] Video completion via player API records a `progress_events` row once.
- [x] Continue lands on the first incomplete required lesson.
- [x] Lesson page first-load JS is under the 300 KB ceiling (target 250 KB), measured on a production server, and renders at 360px with no horizontal scroll.
- [x] Browser loop passed on the dev server: catalogue, course, lesson, dashboard, sign-in; signed out and signed in; light and dark; desktop and 390px; at least two fix-and-reload iterations recorded in `test.md`.

Depends on: S2.

### S4. Quizzes and exercises — `done` (`8e0f80e`)

Plan: [`specs/S4-quizzes-exercises/plan.md`](./specs/S4-quizzes-exercises/plan.md)

Scope: F1.5, F1.6. Server-graded quizzes; JS/TS exercises in a Web Worker with an in-house vitest-subset harness (Sandpack dropped: unmaintained since 2025-04), edited in CodeMirror 6; results recorded as events; completion rules `quiz_pass` and `exercise_pass`.

Decision (founder, 2026-09-06, after S4 landed): **exercises are JavaScript and TypeScript only.** The Pyodide Python runner shipped in S4 was removed the same day (`exercise_runner` enum reduced to one value, migration `0004_drop_python_runner`, then renamed `sandpack` → `browser` in `0005_rename_runner`, the Python exercise removed from the content repo). One runner, done well, is the product; a second language is a new spec, not a runner flag.

Acceptance criteria

- [x] Correct answers never reach the client (checked via network tab and a test on the RSC payload).
- [x] Quiz attempt stores the question version snapshot; regrading after a content change is possible.
- [x] A passing exercise records an event with the submitted code; a failing one does not complete the lesson.
- [x] ~~Pyodide loads only on Python exercises and is cached (second load is instant).~~ Verified, then superseded by the JS/TS-only decision below; the runner was removed.
- [x] Browser loop passed on the dev server for quiz and exercise lessons (both runners), signed out and in, light and dark, desktop and narrow; at least two fix-and-reload iterations recorded in `test.md`.

Depends on: S3.

### S5. Email, moderation core, notifications — `done` (`d586a0c`)

Plan: [`specs/S5-email-moderation-notifications/plan.md`](./specs/S5-email-moderation-notifications/plan.md)

Scope: X1 (email provider), X2 (moderation queue, flags, audit log, policy page), X4 (in-app notifications). Better Auth email verification and organization invitations wired to the provider. Shared by S6, S7, S9, S10.

Acceptance criteria

- [x] Verification and invitation emails send in dev via a local catcher (Mailpit in docker-compose) and in prod via Resend (plan decision 1; Postmark kept as a one-file alternative).
- [x] `moderation_items` supports any subject type; approve/reject/edit/merge actions are logged with actor and reason.
- [x] Mentors see only their track's content items; admins see all.
- [x] Notifications table with read state; in-app list in the app shell header.

Depends on: S1. Parallel-safe with S3/S4.

### S6. Ratings, course reviews, and discussions — `done` (`5022ebb`)

Plan: [`specs/S6-ratings-reviews-discussions/plan.md`](./specs/S6-ratings-reviews-discussions/plan.md)

Scope: area 4 in full (F4.1 to F4.7, N4.1 to N4.3). Inline lesson rating with tags at completion; course reviews gated on 50 percent completion; discussions (questions, notes, replies, upvotes, accepted answers) under lessons and courses with Markdown rendered and sanitised on the server, holds for links from new accounts, flags and hides through the S5 queue, notifications through `@repo/notify`; aggregates on lessons and courses recomputed on write. Founder decision 2026-09-06: general comments and replies ship here rather than in a later spec; the former S12 is folded in.

Acceptance criteria

- [x] One rating per user per lesson, editable; aggregates recompute on write.
- [x] Course review form only appears at ≥ 50 percent completion; one review per learner per course, shown with a completion badge.
- [x] Unclear-tag rate, average rating, and open-question count are queryable per lesson (feeds S11).
- [x] Comments load after the lesson body (client island) and never block it; their text is not in the server HTML.
- [x] Threads are one level deep; accepted answer pins first in its thread; the question author is notified on replies.
- [x] Links from accounts younger than seven days are held for moderation; approve publishes, reject hides; readers can flag; every removal is logged.
- [x] Browser loop passed on the dev server; at least two fix-and-reload iterations recorded in `test.md`.

Depends on: S3, S5.

### S7. Certificates and public profiles — `done` (`f27af70`)

Plan: [`specs/S7-certificates-profiles/plan.md`](./specs/S7-certificates-profiles/plan.md)

Scope: F1.18 to F1.20, X5. Issue on completion criteria, verify page, PDF with QR, revocation, opt-in public profile with certificates.

Acceptance criteria

- [x] Certificate issues in the same transaction as course completion, with a criteria snapshot and `content_revision` reference.
- [x] `/verify/[uuid]` is public, indexable, shows the snapshot, and says "revoked" with reason when revoked.
- [x] PDF is generated server-side, cached in object storage (R2 in production, MinIO locally and in CI; no raw files in Postgres), re-downloadable.
- [x] Public profile shows name, city, certificates; private by default.

Depends on: S3, S5.

### S8. Badges and streaks — `done` (`c83babe`)

Plan: [`specs/S8-badges-streaks/plan.md`](./specs/S8-badges-streaks/plan.md)

Scope: F1.16, F1.17, plus streak and activity computation from `progress_events`. Badge rules defined in the content repo and evaluated against the event stream, manual admin awards, streaks and an activity graph on the dashboard and public profile.

Founder decisions 2026-09-06: **the MVP is self-learning with automated checks only.** Badge rules never fail CI, and `first_project_accepted` stays earnable once project lessons run their automated tests. Notification emails are throttled per learner. No badge backfill: the MVP has no users, so badges apply from publication onward. Leaderboards are out for now, not forever. Project submissions and their mentor review moved to the backlog with AI-assisted review; nothing in the MVP requires a human to accept a learner's work. Badges and streaks stay because they are computed, not judged.

Acceptance criteria

- [x] Badge rules defined in the content repo (`badges/*.yaml`) evaluate against events; a "5 lessons in 7 days" badge awards exactly once.
- [x] Rules are evaluated on write (the same transaction that records the event) and are idempotent under `rebuildLearner`.
- [x] Admins can award and revoke a badge manually, with a reason, recorded on the award row and shown in `/admin/badges` (plan decision 7).
- [x] Streak and activity graph computed from events and shown on the dashboard and the public profile.
- [x] `notify()` throttles emails per learner without dropping the in-app row.

Depends on: S5, S7.

### S9. Cohorts: syllabus and org dashboards — `deferred`

Deferred on 2026-09-07: cohorts serve institutions, and the platform has no learners yet, so an organisation dashboard would have nothing to show. The organisation and team tables, the `enrollments.team_id` column, and invitation emails already exist, so this resumes without re-modelling. Pick it up when an institution asks.

Scope: F1.21, F1.22. `cohort_courses`, cohort deadlines on learner dashboard, org staff aggregate view, per-learner view scoped to cohort membership.

Acceptance criteria

- [ ] Org owner creates a cohort, attaches ordered courses with dates, invites members (email via S5).
- [ ] Members see cohort deadlines; staff see percent complete per course and active learners this week.
- [ ] A staff member cannot see progress of a learner outside their cohorts (test).

Depends on: S3, S5.

### S10a. Company bank: companies, reviews, interviews — `done`

Plan: [`specs/S10-company-bank/plan.md`](./specs/S10-company-bank/plan.md)

Scope: area 2 phase 1 without salaries (F2.1 to F2.5, F2.8 to F2.14; N2.1 to N2.3). A company is an organisation (`kind = "company"`) in Postgres with its profile in `company_profiles` and its logo in R2; companies leave the content repo. Proposals, reviews, and interview experiences, all moderated by admins before they appear and anonymised by column set, with a directory, Postgres search, and indexable pages. Founder decisions 2026-09-07: split from salaries, aggregates from a plain Postgres view, thin pages indexed, admins only.

Commit: `f876eb5`. Records: [`review.md`](./specs/S10-company-bank/review.md), [`test.md`](./specs/S10-company-bank/test.md)

Acceptance criteria

- [x] Public payloads and APIs contain no user ids or exact dates (tested on serialisation; `reviewPublicColumns` / `interviewPublicColumns` are the only public reads, and the month is computed in Asia/Karachi at read time).
- [x] Reviews and interviews are invisible until approved; one review per company per user (unique index, and an edit returns the row to pending).
- [~] A company page reflects a decision immediately, verified in the browser in both directions. It is not statically rendered: the shared header reads the session, so the page is dynamic like `/courses`. A cached-read layer was built and removed when it left a hidden review public for seconds; see `review.md`.
- [x] A company is an organisation row; claiming one later is organisation membership, needing no re-modelling.
- [x] Browser loop passed on the dev server; three fix-and-reload iterations recorded in `test.md`.

Depends on: S5, S7 (storage).

### S10b. Company bank: salaries — `done`

Commit: `86bedb4`. Plan: [`specs/S10b-salaries/plan.md`](./specs/S10b-salaries/plan.md). Records: [`review.md`](./specs/S10b-salaries/review.md), [`test.md`](./specs/S10b-salaries/test.md)

Scope: F2.6, F2.7, F2.11 (the salary half of the split above). Salary points stored as earned, aggregated per role with the n ≥ 5 rule, shown in the currency they were earned in, individual points never selectable. Founder decisions 2026-09-07: display in the submitted currency with conversion from a daily-refreshed `fx_rates` table; salary points publish at once and carry an unverified mark until an admin checks them; the floor stays at five for every cell.

Acceptance criteria

- [x] Salary cells with n < 5 fall back to the role aggregate or "not enough data". The floor is a `HAVING` clause inside the two views, alongside rounding to a per-currency step and withholding the middle half below n = 8 — the floor alone published three of five people's exact salaries, because `percentile_cont` lands on raw values at that size (found in review).
- [x] One salary point per company per user; individual points never appear in any public payload (tested on serialisation).
- [x] Percentiles are computed in Postgres by `percentile_cont`, not over fetched rows, and rounded there too. Aggregates cover staff roles reported in the last three years; internships and older figures are excluded rather than averaged in.
- [x] Salaries display in the currency submitted, with conversion only as an aid.
- [x] Browser loop passed; five fix-and-reload iterations recorded in `test.md`.

Depends on: S10a.

### S10c. Company bank: flags and logos — `done`

Plan: [`specs/S10c-flags-logos/plan.md`](./specs/S10c-flags-logos/plan.md). Records: [`review.md`](./specs/S10c-flags-logos/review.md), [`test.md`](./specs/S10c-flags-logos/test.md)

Scope: the two gaps S10a recorded for later, plus what planning them turned up. Readers can flag a company review, an interview experience, a salary point, and a role's published figures, choosing a reason that is what gets stored. Company marks fall back from an uploaded logo to the icon on the company's own website (fetched server-side and cached in R2) to a generated monogram. Founder decisions 2026-09-07: salary points are flaggable; logos are uploaded by admins; the website icon is the default fallback.

Acceptance criteria

- [x] A reader can flag a company review, an interview experience, and a role's salary figures, choosing a reason that is what gets stored — S6's flag button had hard-coded "off topic" for everything.
- [x] Upholding a flag hides the subject, including a salary point whose item is still pending.
- [x] A mark always renders: uploaded logo, then the site's own icon, then a monogram. The route never 404s for a company, so there is no broken image to guard against.
- [x] Uploads refuse anything but a small image, and a fetched icon can never reach a private address (`isSafeIconUrl`).
- [x] Browser loop passed; three fix-and-reload iterations recorded in `test.md`.

Depends on: S10a, S10b.

### S11. Mentor studio and dashboard — `todo`

Scope: area 3 phase 2 (F3.3, F3.7, F3.8, F3.9). Keystatic at `/studio` in GitHub mode for mentors; mentor application and role flip; dashboard with revision signals and the moderation queue; attribution on lessons. (The project review queue left with the S8 scope change.)

Acceptance criteria

- [ ] A mentor with no git knowledge edits a lesson in Studio and a PR appears on `devhelp-content`.
- [ ] Dashboard lists lessons below rating threshold or above unclear-tag rate (from S6).
- [ ] Contributors page and lesson attribution render from frontmatter.

Depends on: S2, S6.

### S12. Comments and Q&A — `merged into S6`

Folded into S6 on 2026-09-06 (founder decision: discussions ship with ratings). Number kept so later references stay valid.

### S13. Company claims and cross-links — `todo`

Scope: area 2 phase 2 (F2.12, F2.15). Company representative claims, public responses, links between company pages and courses.

Depends on: S10a, S3.

### S14. Search, analytics, launch hardening — `todo`

Scope: X3 (Postgres full-text search across courses, lessons, companies), X6 (Plausible/Umami), X8 (performance budget audit), X9 (fresh-clone run-through), security review of auth and moderation, CI including Postgres integration tests.

Acceptance criteria

- [ ] Fresh clone to running app in under 10 minutes following README only.
- [ ] `/security-review` findings addressed.
- [ ] Lighthouse mobile ≥ 90 on catalogue, lesson, company page.

Depends on: everything above.

---

## Follow-ups (open, not tied to a spec)

Founder actions

- Create the Resend account and verify the `devhelp.pk` sending domain, then set `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` in production; create the `policy@devhelp.pk` mailbox named on `/policy` (S5).
- Set the `PLATFORM_PR_TOKEN` secret on `devhelppk/devhelp-content` (fine-grained token, contents + pull requests write on the platform repo) so merged content opens lock-bump PRs automatically. Until then promote by editing `content.lock.json`.
- Replace the placeholder video id in `courses/ai-engineering-foundations/01-getting-started/02-how-agents-work.mdx` with a real lesson video.
- Ratify the bundle budget numbers in `scripts/check-bundle-budget.ts` (target 250 KB, ceiling 300 KB) or tighten them.
- Schedule `pnpm fx:refresh` daily in production (S10b). Without it the salary tables still work and still show what people were paid; they simply do not offer the converted PKR figure beside a USD one.

Technical

- **Exercise verification (decided at the end of S4, founder to confirm):** exercise pass/fail stays browser-reported. Every submission stores the files and per-test results and the server rejects a pass claim that contradicts them, so any submission can be replayed later. Server-side execution (a sandboxed runner replaying stored files against the tests) is scheduled for S7, where certificates make it a trust requirement; until then the `verified` flag on exercise submissions does not exist and certificates must not be issued from exercise passes alone.
- The `foundations-check` quiz description in the content repo says "Two questions" but the quiz has four; fix the copy in `devhelppk/devhelp-content`.
- `checkContentAsync` keeps a second solution/starter loop for the browser harness next to `checkContent`'s vitest loop; fold them if a third runner kind appears.
- Better Auth's `allowUserToCreateOrganization` reads the role from the session cookie cache, so a newly promoted mentor or admin can create an organization only after the cache expires (5 minutes) or a re-sign-in; role-gated platform pages already read fresh. Revisit if organization creation moves into a platform flow (S9).
- The email digest for notifications (X4) is a scheduler over `notifications.emailed_at`; build it when S6 discussions produce enough volume.
- Create the Cloudflare R2 bucket and API token and set `S3_*` in production; the env check fails deliberately without them, and `pnpm certificates:backfill` should run once on the first deploy.
- The course page fetches the learner's certificate list to find one by course; add a `byCourse` procedure with the S8 dashboard work.
- Comment code blocks are styled but not syntax-highlighted; run Shiki at write time if mentors ask (S6 decision 4).
- The `comments.anchor` column is written by the API but the lesson UI does not yet offer "comment on this section"; add it with the S11 mentor tooling.
- Lesson pages call `getSession` three times per request (header, page, tRPC context); thread the session through the API context when S5 touches auth.
- `courseProgress` in the learning router awaits three queries sequentially; batch if a course page ever exceeds a few hundred milliseconds.
- `/courses` and `/paths/[path]` are dynamic because the header reads the session; if catalogue traffic grows, move the header behind Suspense and cache the rest.
- Drizzle-kit rename prompts need a pty from agent shells (see `AGENTS.md`); a non-interactive flag upstream would remove the workaround.
- Mobile checks ran at 500 px (Chrome's minimum window width here); verify 360 px on a real device or device emulation before launch.
- The S1 review record was corrected in S3: an edit it claimed had not applied. When a python/sed edit targets prettier-formatted code, grep for the result before claiming it landed.

## Backlog (post-launch, recorded so they are not forgotten)

- Offline tolerance for lesson pages and progress writes (F1.14).
- Alternative video providers (Mux, Cloudflare Stream).
- **Project submissions and review (deferred from S8 on 2026-09-06).** `project` lessons accepting a repo URL, a review queue with structured feedback, and the `submitted → changes_requested → accepted` flow. Post-MVP, and the founder wants AI-assisted review considered alongside mentor review when it returns. The schema already carries the `project` lesson type, the `submit` completion rule, the `project_submitted` event kind, the empty `projects` array in the certificate snapshot, and `requireProjectAccepted` in course completion criteria, so nothing needs to be re-modelled.
- **Badge backfill (dropped from S8 on 2026-09-06: no users yet).** When learners exist and a badge is added, replay each learner's events through `evaluateBadges` to award it retroactively, silently. The evaluator already takes a whole event and is idempotent, so the script is short.
- Peer review before mentor review on projects.
- Company-bank verification mechanics (work-email or document) and employer accounts / job openings.
- Email digests for notifications.

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
- [x] `notify()` throttles emails per learner without dropping the in-app row. Superseded 2026-09-12 (founder): **notification emails are off entirely** to save sending cost — `emailingKinds` is empty, so every notification is in-app only. The throttle, the `email` input and the `emailed_at` stamp all remain, so turning a kind back on is one line and the digest (X4) still has something to build on.

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
- [x] A company page reflects a decision immediately, verified in the browser in both directions. It is not statically rendered, and that is settled rather than outstanding (founder, 2026-09-12): static rendering is the wrong goal for this page. Nearly all of it is moderated content that must be fresh, plus a session read for the report controls, so a static shell would cover only the header chrome — while any cache over it risks the one failure the freshness rule exists to prevent. A cached-read layer was built and removed in S10a when it left a hidden review public for seconds; see `review.md`. The page is dynamic like `/courses`, reading three indexed selects.
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

Commit: `3a98b32`. Plan: [`specs/S10c-flags-logos/plan.md`](./specs/S10c-flags-logos/plan.md). Records: [`review.md`](./specs/S10c-flags-logos/review.md), [`test.md`](./specs/S10c-flags-logos/test.md)

Scope: the two gaps S10a recorded for later, plus what planning them turned up. Readers can flag a company review, an interview experience, a salary point, and a role's published figures, choosing a reason that is what gets stored. Company marks fall back from an uploaded logo to the icon on the company's own website (fetched server-side and cached in R2) to a generated monogram. Founder decisions 2026-09-07: salary points are flaggable; logos are uploaded by admins; the website icon is the default fallback.

Acceptance criteria

- [x] A reader can flag a company review, an interview experience, and a role's salary figures, choosing a reason that is what gets stored — S6's flag button had hard-coded "off topic" for everything.
- [x] Upholding a flag hides the subject, including a salary point whose item is still pending.
- [x] A mark always renders: uploaded logo, then the site's own icon, then a monogram. The route never 404s for a company, so there is no broken image to guard against.
- [x] Uploads refuse anything but a small image, and a fetched icon can never reach a private address (`isSafeIconUrl`).
- [x] Browser loop passed; three fix-and-reload iterations recorded in `test.md`.

Depends on: S10a, S10b.

### S11. Mentor studio and dashboard — `done`

Commit: `eb3fbe1`. Plan: [`specs/S11-mentor-studio/plan.md`](./specs/S11-mentor-studio/plan.md). Records: [`review.md`](./specs/S11-mentor-studio/review.md), [`test.md`](./specs/S11-mentor-studio/test.md)

Scope: F3.3 (reshaped), F3.8, F3.9. Founder decisions 2026-09-07 turned this from "mount Keystatic" into a change of the S2 contract: **the content repo stops owning metadata**. Mentors edit course and lesson metadata in the app; prose, quizzes, and exercises stay a pull request. Credits become rows pointing at users. The dashboard starts with the signals S6 already collects. No Keystatic, no lesson-body editing, no GitHub issues yet.

Acceptance criteria

- [x] A mentor edits a course and a lesson's metadata in the app, and a later `content:sync` does not undo it — checked against the real content, not only a fixture.
- [x] A metadata key left in the content repo fails `content:check` with `[moved-field]` naming where that field lives now.
- [x] A newly synced course is unpublished, listed as needing metadata, and cannot reach the catalogue until someone completes it.
- [x] Every metadata change is attributable: who, what, before, after.
- [x] Credits are users; a lesson byline and `/contributors` render from them.
- [x] The dashboard lists lessons below the rating threshold, above the unclear-tag rate, or with unresolved questions.
- [x] Browser loop passed; three fix-and-reload iterations recorded in `test.md`.

Depends on: S2, S6. Shipped as one spec; the cut did not need splitting. Paths follow the same rule as courses. ~~**Blocked on a founder action:** the `devhelp-content` commits that strip metadata must be pushed and `content.lock.json` bumped.~~ **Unblocked (verified 2026-09-12).** The commits were already pushed (`origin/main` is `6bf0e95`, "Paths follow the same rule as courses", on top of `1783f63` "Metadata moves to the platform") and `content.lock.json` already pins that sha. Verified end to end rather than from the note: `content:pull` → `content:check` (2 courses, 1 path, 0 errors) → `content:sync`, which reported `+0 ~0 =N -0` for every kind — the S11 criterion that a later sync does not undo studio-held metadata.

### S12. Comments and Q&A — `merged into S6`

Folded into S6 on 2026-09-06 (founder decision: discussions ship with ratings). Number kept so later references stay valid.

### S13. Company claims and public responses — `done`

Commit: `d6a8883`. Plan: [`specs/S13-company-claims/plan.md`](./specs/S13-company-claims/plan.md). Records: [`review.md`](./specs/S13-company-claims/review.md), [`test.md`](./specs/S13-company-claims/test.md)

Scope: F2.12's public half — a company representative claims the profile and can answer publicly what is written about them. Founder decisions 2026-09-07: a claim needs a work-email domain match plus admin approval; a response is queued like every other contribution; **F2.15, the company-to-course cross-links, is deferred.**

Acceptance criteria

- [x] A claim records what evidence was checked, and approving one makes the claimant an organisation member.
- [x] Only a member of that company can write a response, and it is invisible until an admin approves it.
- [x] A response renders under the post it answers, attributed to the company rather than a person.
- [x] An edited response returns to the queue and cannot republish something an admin hid.
- [x] Browser loop passed; three fix-and-reload iterations recorded in `test.md`.

Depends on: S10a, S6 (the Markdown pipeline).

### S14. Search, and getting to a launch — `done`

Commit: `a38d021`. Plan: [`specs/S14-search-launch/plan.md`](./specs/S14-search-launch/plan.md). Records: [`review.md`](./specs/S14-search-launch/review.md), [`test.md`](./specs/S14-search-launch/test.md)

Scope: X3 (Postgres full-text search across courses, lessons, and companies), X8 (performance audit), X9 (MIT licence, contribution guide, security policy, and a timed fresh-clone run), and the security review. Founder decision 2026-09-07: **X6, analytics, is deferred post-MVP** — X9 requires the platform to run on a laptop with no paid keys, and a self-hosted analytics service is one more thing to run before there is anyone to measure.

Acceptance criteria

- [x] Search returns courses, lessons, and companies for a plain query, and never returns something unpublished.
- [x] Fresh clone to running app in under 10 minutes following the README only: **3 minutes 5 seconds**, timed on a real clone. The run found the README's quick start in the wrong order.
- [~] Lighthouse mobile ≥ 90 on the catalogue (90) and a company page (90); **a lesson page scores 88–90 and does not reliably meet it**. Its own metrics are excellent and its observed LCP is 872 ms; the score is Lighthouse's simulated LCP over the route's 230 KB of JavaScript. One attempted fix did not work and was reverted. See `review.md`.
- [x] `/security-review` ran over S13 and S14 and found nothing meeting its reporting bar; two notes below the bar are written down in `review.md`.
- [x] MIT licence, contribution guide, and security policy present, and the contribution guide's setup path is the one that was actually timed.

Depends on: everything above.

### S15. Company page: information hierarchy, and a give-to-get gate — `complete`

Plan: [`specs/S15-company-gate/plan.md`](./specs/S15-company-gate/plan.md). Records for both parts: [`test.md`](./specs/S15-company-gate/test.md)

**Both parts are done.** Part A (the design pass) was verified in the browser. Part B (the gate) is enforced in two places: `requireBankAccess` at the top of every procedure that returns a contribution, and `companies.eligibility` asked by the page _before_ it fetches anything gated — because a page that fetched first and walled second would still ship every review in its RSC payload. The wall is synthetic text written in `gate-wall.tsx`; the response body of a signed-out request contains none of the real reviews, checked with `curl` and `grep`, not in a browser. The founder decisions were taken as D1 two-tier, D2 verified-only below 250 published contributions, D3 pending counts / rejected does not, D4 admins, mentors and a company's own members exempt.

Scope: two halves of one page. (a) A design pass on `/companies/[slug]` — orientation facts currently land last on mobile, the recommend-rate sits below the sub-scores that explain it, five sub-scores are printed to one decimal off two reviews, and `h3` does duty at three different levels. (b) A give-to-get gate: company detail is for viewers with a verified email who have contributed to any company in the last 365 days; everyone else sees a synthetic mockup, with the real rows never fetched, never in the RSC payload, and never reachable by a hand-made API call.

**Three founder decisions block planning** (detail and recommendations in the plan):

- **D1.** The gate contradicts F2.14 — _"company pages are public and indexable; they are the main SEO entry point"_. Recommended: a two-tier page, facts public and indexable, contributed content gated; F2.14 rewritten either way.
- **D2.** Cold start. Taken literally the rule is circular — nobody may read without contributing, nobody contributes to a bank they cannot read, and there are no users. Recommended: verified email alone is the gate until the bank holds 250 published contributions, then the contribution rule switches itself on.
- **D3.** Recommended: a `pending` contribution counts, a `rejected` or `hidden` one does not.

Part A, shipped: at-a-glance strip (recommend rate, roles with pay, review and interview counts) doubling as jump navigation; `Facts` moved ahead of the content on anything under 1024px, where it used to sit below every review, pay table and interview; sections reordered to Pay → Reviews → Interviews; sub-scores withheld below five reviews rather than printing five one-decimal averages off two; card field labels demoted from `h3` so the heading outline is one level per level. Deviation from the plan: the order is Pay → Reviews → Interviews rather than the planned Pay → Interviews → Reviews, because splitting the two experience sections around pay read worse than keeping "what it is like" next to "how to get in".

Part B acceptance criteria: in the plan. The one that matters most is a test — not a browser observation — that an ineligible viewer's response body carries no contributed content.

Depends on: S10a, S10b, S10c, S13, S14.

### S16. The signed-in shell, and controls that are actually shadcn — `done`

Plan: [`specs/S16-shell-and-controls/plan.md`](./specs/S16-shell-and-controls/plan.md). Records: [`test.md`](./specs/S16-shell-and-controls/test.md)

**Both halves are built.** D1 and D4 were taken as recommended; **D2 was revised while testing** — the rail is chosen by session rather than by route, because scoping it to the signed-in tools meant the rail's own "Courses" link made the rail disappear. Signed-out visitors, including every crawler, still get the indexable header with no rail. **D3 was resolved in S20**: the reader is on shadcn's `Sidebar` and `AppShell` / `SidebarNav` / `MobileNav` are deleted, so the package has one sidebar system. It cost the reader 29.7 KB gz of first-load JS (230.0 → 259.7, ceiling 300), measured rather than assumed. Both checks are closed. The converted selects **have** been opened in dark mode as an admin (the `/admin/badges` badge picker's listbox renders readable text on a themed popup, verified 2026-09-12), and the shell had its live 390px pass in S20 across the admin, moderation, studio and account pages.

Scope: (a) shadcn's `Sidebar` as the shell for the signed-in tools — `/account`, `/notifications`, `/badges`, `/certificates`, `/studio`, `/moderate`, `/mentor`, `/admin` — with role-gated groups, the cookie-backed collapsed state and `cmd/ctrl+B`; public pages keep `SiteHeader`. (b) The seven remaining native `<select>` elements become shadcn selects, plus a sweep for other hand-rolled controls. Every component added through `pnpm dlx shadcn@latest add`, never written by hand.

**Founder decisions in the plan:**

- **D1.** The linked doc is shadcn's **Base UI** sidebar; `@repo/ui` is Radix throughout. Recommended: take the Radix build rather than run two primitive libraries.
- **D2.** Signed-in tools only — a 16rem nav rail on a public page spends the width S15 just won on navigation for a visitor who came to read one page.
- **D3.** Whether `AppShell` / `SidebarNav` / `MobileNav` are ported onto `Sidebar` and deleted, or kept and marked reader-only.
- **D4.** **The 250 KB target is guidance, not a gate** (founder, 2026-09-12). N1.1 already said the limit "does not drive quality trade-offs"; the 300 KB ceiling stays as a regression alarm. This spec will cross 250 on some pages, knowingly.

Good news found while planning: the `--sidebar-*` CSS variables already exist in `globals.css` in both themes, on the brand hue, scaffolded with the design system and never used. The theming is done.

Depends on: S15 part A2.

### S17. Density: vertical space and two-column organisation — `done`

Review and records: [`specs/S17-density/review.md`](./specs/S17-density/review.md)

Reviewed the signed-in pages in Chrome and found the cause was systemic rather than per-page: every non-`wide` page rendered a 768px column **centred** in the shell's ~1250px inset, so with the rail already taking the left the content floated in the middle with ~240px dead on each side — and the wasted height followed from the wasted width.

Done: the narrow measure is left-aligned in the tools shell; `/account` is a two-column card layout on a wide shell (five stacked sections and ~1700px of page became one screen, with Name and City paired as the link row below them already was); `/badges` moved to the wide shell so its grid stops wrapping every description onto three lines.

Checked and dismissed: `/notifications` "missing" Mark all read (it renders only when something is unread), and the notification rows themselves (already compact).

`/studio`, `/moderate` and the admin pages were reviewed and fixed under S18. The dashboard (`/`) was checked on 2026-09-12 and needed nothing: it is already on the wide shell with two-up course and badge cards and no dead width. Nothing identified as left.

### S18. Admin, moderation and studio pages: review and cleanup — `done`

Commits: `5d84b15`, `3708738`, `6d2c204` (plus `55129a2`, which restored what the S16 port dropped). Records: [`specs/S18-admin-review/review.md`](./specs/S18-admin-review/review.md)

Not planned as a spec — it began as "review and test the admin pages" and found
enough to be one. Seven functional defects, the largest being a moderation queue
that could only ever show 30 of 1015 items because the UI ignored a cursor the API
had returned since S5, and rows that read `<kind> by someone` while the payload
snapshot they were storing went unshown. Also: the queue item detail became a
`shallow: false` nuqs dialog, rare forms moved behind an Add button, row actions
moved onto their rows, the learner id field became an async search select, and the
five pages my own S16 port had silently stripped `wide` from were restored. The
general rule this produced — `PageHeader` with the primary action in its `actions`
slot, never a hand-rolled header — is in `AGENTS.md` and `DESIGN.md`.

Everything the review left open (`/studio/paths/[slug]`, `/studio/lessons/[id]`,
`/admin/certificates` pagination, the static mobile audit) landed in `6d2c204`.
Still open: the queue has no bulk action, and no admin page has had a live 390px
pass.

### S19. Platform review against the full spec — `done`

Records: [`specs/S19-platform-review/review.md`](./specs/S19-platform-review/review.md)

A read across all 78 requirements, the code, the running server and the dev
database (2026-09-12). Conclusion: every requirement is built except the ones
deliberately deferred, plus two real gaps — F2.9's "merge duplicate companies"
(the `merged` status exists and no action can reach it) and F2.15's cross-links
(deferred in S13) — and one wording drift, X8's "static-rendered with ISR", which
company and catalogue pages knowingly are not. Two things found that were in
nobody's list: the dev database has 19 published test-leftover courses that reach
`/courses`, and no content metadata has ever been entered (both courses have no
estimated hours, all 61 lessons no duration, `content_credits` empty), so the
catalogue reads "0 min · written by nobody". The second is the only thing in the
review that would embarrass a launch.

### S20. Company merge, one sidebar, and the review's loose ends — `done`

Plan and records: [`specs/S20-merge-and-loose-ends/plan.md`](./specs/S20-merge-and-loose-ends/plan.md)

Everything S19 left open, in one pass. **F2.9's company merge** is built — the last
unbuilt functional requirement: migration `0022_company_merge` (a `merged` company
status, a `merged_into_id` pointer, and a `company_merges` audit row carrying what
moved and what stayed), `companies.merge` as an admin procedure, a row action and
dialog on a rewritten `/admin/companies` table, and a 308 redirect for the merged
slug. The losing company is never deleted, because deleting an organisation
cascades away everything written about it; a contribution that cannot move (one
review per author per company) stays on the merged record rather than being
deleted or given a moderation status nobody chose.

**S16 D3 is resolved**: the lesson reader moved onto shadcn's `Sidebar` and the
hand-rolled `AppShell` / `SidebarNav` / `MobileNav` trio is deleted. Measured
cost: the reader's first-load JS went 230.0 → 259.7 KB gz (ceiling 300).

Also: the catalogue stopped printing "0 min" for courses whose durations are not
entered; `sync.test.ts` stopped leaking a course per run; `pnpm db:clean-fixtures`
cleans up after a killed run (39 rows were sitting in the dev catalogue);
`COMPANY_BANK_WARM_AT` makes S15 D2's threshold configurable, which is also what
made the third gate wall reachable in development; X8's ISR wording now matches
what we actually do; and a 390px pass found the handle field clipping its own
prefix.

Depends on: S15, S16, S18, S19.

---

## Follow-ups (open, not tied to a spec)

Founder actions

- ~~Push the `devhelp-content` metadata commits and bump `content.lock.json` (S11).~~ Done before this was written; verified 2026-09-12.
- ~~Create the Resend account and verify the `devhelp.pk` sending domain~~ — done; `devhelp.pk` is verified in Resend (region `ap-northeast-1`), and a real send through `sendEmail` was delivered end to end on 2026-09-12, so `EMAIL_FROM="devhelp <no-reply@devhelp.pk>"` works as it stands. Still to do: set `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` **in production** (local dev stays on Mailpit), and create the `policy@devhelp.pk` mailbox named on `/policy` (S5).
- Set the `PLATFORM_PR_TOKEN` secret on `devhelppk/devhelp-content` (fine-grained token, contents + pull requests write on the platform repo) so merged content opens lock-bump PRs automatically. Until then promote by editing `content.lock.json`.
- Replace the placeholder video id in `courses/ai-engineering-foundations/01-getting-started/02-how-agents-work.mdx` with a real lesson video.
- ~~Ratify the bundle budget numbers in `scripts/check-bundle-budget.ts` (target 250 KB, ceiling 300 KB) or tighten them.~~ **Ratified 2026-09-12 (founder): the 250 KB target is guidance, not a gate, and must not block a better product.** The 300 KB ceiling stays as a regression alarm. N1.1 already carried this sense — "the limit catches regressions; it does not drive quality trade-offs" — so nothing in the requirement changes; the decision is recorded here and in S16's D4 so it is not re-argued each time a page gains a component.
- Decide whether the lesson route's 230 KB of first-load JavaScript is worth reducing (S14). It is the one page that does not reliably reach Lighthouse 90 on mobile, though its measured load is fast; the score is a model of the payload, not a wait.
- Schedule `pnpm fx:refresh` daily in production (S10b). Without it the salary tables still work and still show what people were paid; they simply do not offer the converted PKR figure beside a USD one.

Technical

- **The lesson reader carries 259.7 KB gz of first-load JS** after the S20 sidebar port, up from 230.0 and over the 250 KB target (the 300 KB ceiling is intact). It is the one page read by signed-out visitors and crawlers. If it needs winning back, render the rail without the client provider when there is no session.
- **`pnpm check-budget` only measures signed-out renders**, so the sidebar shell on every signed-in page is unmeasured. Teaching the script to sign in with `dev:admin` would close that blind spot.
- ~~**An intermittent test failure under parallel runs, seen in S8, S10b, and S11.**~~ **Fixed 2026-09-12.** Cause: `issueCertificate`'s fallback for a pruned `content_revisions` row. The insert names the revision as a foreign key; when a concurrent `content:sync` (only `sync.test.ts` deletes those rows, which is why it needed parallel runs) removed it between the snapshot read and the write, the insert raised `23503` — and a foreign key violation aborts the entire Postgres transaction, so the fallback insert in the `catch` failed with `current transaction is aborted, commands ignored until end of transaction block` and took the whole course-completion transaction with it. That is why it was always a different test and always one ending in a certificate insert. The first insert now runs in a savepoint (a nested drizzle transaction), so the violation rolls back to the savepoint and the fallback proceeds. `insertCertificateRow` was split out to make the race testable without timing tricks, and `certificates.test.ts` covers it: the test fails with the exact production error when the savepoint is removed.
- **Exercise verification (decided at the end of S4, founder to confirm):** exercise pass/fail stays browser-reported. Every submission stores the files and per-test results and the server rejects a pass claim that contradicts them, so any submission can be replayed later. Server-side execution (a sandboxed runner replaying stored files against the tests) is scheduled for S7, where certificates make it a trust requirement; until then the `verified` flag on exercise submissions does not exist and certificates must not be issued from exercise passes alone.
- **Video lessons had no way to complete without YouTube (found and fixed 2026-09-12, outside a spec).** `completionRule` is `view` for video just as for articles, but the lesson page hid the mark-done control for `type === "video"`, leaving the player's `ENDED` event as the only completion signal. If YouTube is blocked, the video is unavailable, the `iframe_api` script fails, or the learner watched it elsewhere, the lesson could never be completed — and because course completion requires every required lesson, that learner could never finish the course or earn its certificate. For an audience in Pakistan that is a plausible everyday state, not an edge case. The manual control now renders for every `view` lesson; both paths send the same idempotent `lessonCompleted`, so completing twice still records one event. Worth a browser-loop pass signed in before launch.
- The `foundations-check` quiz description in the content repo says "Two questions" but the quiz has four; fix the copy in `devhelppk/devhelp-content`.
- `checkContentAsync` keeps a second solution/starter loop for the browser harness next to `checkContent`'s vitest loop; fold them if a third runner kind appears.
- Better Auth's `allowUserToCreateOrganization` reads the role from the session cookie cache, so a newly promoted mentor or admin can create an organization only after the cache expires (5 minutes) or a re-sign-in; role-gated platform pages already read fresh. Revisit if organization creation moves into a platform flow (S9).
- The email digest for notifications (X4) is a scheduler over `notifications.emailed_at`; build it when S6 discussions produce enough volume. Now the more likely route back to notification email: with `emailingKinds` empty (founder, 2026-09-12), a periodic digest costs one send per learner rather than one per event, which was the cost worry behind switching them off.
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

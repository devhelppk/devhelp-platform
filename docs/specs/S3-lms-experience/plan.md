# S3 plan: LMS catalogue and lesson experience

Status: `done` (see `review.md`, `test.md`). Deviations after implementation and review: budget set by the founder to 250 KB target / 300 KB ceiling (the 150 KB figure was below the Next 16 floor); catalogue, path, and course pages render dynamically because the header reads the session (decision 8's ISR did not apply); lesson start/complete keys carry the enrolment generation; the account menu is server-rendered without the auth client; a database-only env slice exists so drizzle-kit needs no auth secrets. Spec entry: `docs/spec.md` → S3. Requirements: F1.1 to F1.4, F1.8, F1.9, F1.10, F1.12; N1.1; X10 (type safety: tRPC, validated env, typed routes). Builds on S1 (`@repo/learning`, progress tables) and S2 (compiled lesson bodies, synced metadata).

## Goal

A learner can find a course, read or watch a lesson, have their progress recorded, and always know what to do next. This spec also introduces the platform's typed API layer, which every later spec uses. Quizzes and exercises render as placeholders here; their runners are S4.

## Decisions

1. **tRPC v11 in `packages/api` (`@repo/api`)** with `@trpc/tanstack-react-query` 11.18 and React Query 5. Routers: `catalogue` (reads over Drizzle: paths, courses, course detail, lesson list), `learning` (writes over `@repo/learning`: enroll, lessonStarted, lessonProgressed, lessonCompleted, drop; reads: myProgress, continue). Context carries the Better Auth session. `superjson` transformer so Dates survive. Server components call routers through a server caller (no HTTP); client components use the React Query hooks. The single `AppRouter` type is the contract, so no hand-written DTOs and no untyped fetch (X10).
2. **Mount once, in the LMS**, at `apps/lms/app/api/trpc/[trpc]/route.ts`. The marketing site does not get an API in S3; it links to the LMS.
3. **Validated env with `@t3-oss/env-nextjs`** in `packages/env` (`@repo/env`), shared by both apps and the packages that read env (`database`, `auth`, `content`). Build fails on a missing or malformed variable. Client-exposed vars use the `NEXT_PUBLIC_` prefix and are validated separately.
4. **`typedRoutes: true`** in both apps (already on in the LMS). Every internal `Link` is checked at build time.
5. **Progress writes are client-initiated through tRPC with client-generated idempotency keys** (`${kind}:${userId}:${lessonId}` for start/complete, plus a nonce for progress ticks). Article and link lessons complete on a "Mark as done" action, not on scroll; video lessons complete through the YouTube IFrame API `onStateChange === ENDED`, with a progress tick every 15 seconds while playing. Rationale: explicit completion is honest and testable, and matches F1.11's completion rules.
6. **Signed-out learners read freely; enrolment and progress need a session.** The lesson page renders for everyone (`isFree` lessons; paid gating does not exist, all content is free). "Enrol" and "Mark as done" send a signed-out visitor to sign-in and back (`callbackURL`).
7. **Sign-in UI ships here, minimal.** `/sign-in` and `/sign-up` pages with email + password and the GitHub/Google buttons when keys are set, built on `@repo/auth/client` and the design system. Without them the learner flows cannot be exercised. Profile, settings, and org UI are later specs.
8. **Course pages are static with revalidation; progress is a client island.** Catalogue, path, and course pages are `revalidate = 300` (metadata changes only on deploy anyway); the lesson page is static for the body and streams a `<LessonProgress>` client component that reads `learning.myProgress` for the course. This meets N1.1 without a per-request DB hit for anonymous readers. The S2 `force-dynamic` proof route is replaced.
9. **Continue** = first required, non-archived lesson in course order whose progress is not `completed`; falls back to the first lesson. Computed server-side in `learning.continue` so the dashboard and the course page agree.
10. **Code highlighting with Shiki** at build time via a rehype plugin in the Content Collections config (`@shikijs/rehype`), themes mapped to the design tokens (light and dark CSS variables), so lesson pages ship no highlighter JS. The S2 copy-button `CodeBlock` stays.
11. **Video via `@next/third-parties` `YouTubeEmbed`** for the lite embed, upgraded to the IFrame Player API on first interaction so completion can be observed. Provider stays a column so others can follow.
12. **Performance budget enforced in CI**: `scripts/check-bundle-budget.ts` fetches each page from a production server, sums the gzipped size of every `<script src>`, and fails above the ceiling. Founder-set during implementation: target 250 KB, ceiling 300 KB (the original 150 KB was below the framework floor of ~155 KB). Exercise and quiz runners (S4) load on demand and are excluded.

## Pages and components

| Route (LMS)                  | Rendering                          | Content                                                                                                                                                                                              |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                          | static                             | Dashboard for signed-in learners: "Continue" card, enrolled courses with progress bars, path position; marketing-style hero for signed-out visitors pointing at `/courses`                           |
| `/courses`                   | static, revalidate                 | Catalogue: filter by track and level, search by title, cards with duration, level, lesson count, rating placeholder                                                                                  |
| `/paths/[path]`              | static, revalidate                 | Roadmap: ordered courses with the learner's status per course                                                                                                                                        |
| `/courses/[course]`          | static, revalidate + client island | Course page: summary, modules and lessons with type icons and duration, prerequisites, "Enrol" / "Continue" button, progress bar                                                                     |
| `/courses/[course]/[lesson]` | static + client island             | Lesson: app shell with course sidebar (modules, lessons, completion ticks), body, mode badge, prev/next, "Mark as done" or video player, quiz/exercise placeholder ("available in the next release") |
| `/sign-in`, `/sign-up`       | static                             | Auth forms                                                                                                                                                                                           |
| `/api/trpc/[trpc]`           | route                              | tRPC handler                                                                                                                                                                                         |

Shared components in `apps/lms/components` (domain-specific, so not in `packages/ui`): `course-card`, `lesson-list`, `progress-bar` (wraps `Progress`), `continue-card`, `lesson-nav`, `mark-done-button`, `video-player`, `enrol-button`, `auth-forms`. The app shell, sidebar nav, and mobile nav from S0 are reused.

## `packages/api`

```
src/trpc.ts        initTRPC with context { session, db }, superjson, error formatter (Zod flatten)
src/context.ts     createContext(headers) → session via auth.api.getSession
src/routers/catalogue.ts   listPaths, getPath, listCourses({ track?, level?, q? }), getCourse(slug), listLessons(courseSlug)
src/routers/learning.ts    enroll, drop, lessonStarted, lessonProgressed, lessonCompleted, myProgress(courseSlug), myEnrollments, continue(courseSlug)
src/root.ts        appRouter, AppRouter type
src/server.ts      createCaller(headers) for RSC
```

`protectedProcedure` throws `UNAUTHORIZED` without a session. Learning mutations derive `userId` from the session, never from input. Inputs are Zod schemas exported for client reuse. Output types are inferred; `questionPublicColumns` is the only way lesson-adjacent quiz data leaves the server (S4 will use it).

Client wiring in the LMS: `lib/trpc/client.tsx` (provider with `httpBatchLink`, superjson, React Query client), `lib/trpc/server.ts` (RSC caller and `HydrateClient` helper for prefetching).

## `packages/env`

`server.ts`: `DATABASE_URL` (url), `DATABASE_POOL_MAX` (int, default 10), `BETTER_AUTH_SECRET` (min 32), `BETTER_AUTH_URL` (url), `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` (optional pairs, validated together), `CONTENT_DIR` (optional), `CONTENT_SYNC_SECRET` (optional). `client.ts`: `NEXT_PUBLIC_LMS_URL`, `NEXT_PUBLIC_WEB_URL`. `packages/database/src/env.ts` and `packages/auth/src/server.ts` switch to it; the root `.env` loading stays where it is.

## Files

- New: `packages/api/**`, `packages/env/**`, `apps/lms/app/{paths/[path],courses/[course],sign-in,sign-up,api/trpc/[trpc]}/**`, `apps/lms/components/**` listed above, `apps/lms/lib/trpc/**`, `scripts/check-bundle-budget.ts`, `.github/workflows/ci.yml` (budget step).
- Changed: `apps/lms/app/page.tsx` (dashboard), `apps/lms/app/courses/page.tsx` (catalogue), `apps/lms/app/courses/[course]/[lesson]/page.tsx` (real lesson page), `apps/lms/content-collections.ts` (Shiki), `apps/lms/app/layout.tsx` (tRPC provider), `apps/web/next.config.ts` (`typedRoutes`), `apps/web/app/page.tsx` (links to LMS via `NEXT_PUBLIC_LMS_URL`), `packages/auth/src/server.ts` and `packages/database/src/env.ts` (use `@repo/env`), `AGENTS.md`, `docs/data-model.md` (no schema change expected), `.env.example`.
- Schema: none planned. If the dashboard needs it, a `lesson_count`/`duration_minutes` aggregate on courses may be added by the sync; decide during implementation and note it.

## Tests

1. `@repo/api` (Postgres): `catalogue.listCourses` filters and excludes archived/unpublished; `getCourse` returns modules and lessons in order; `learning.enroll` and `lessonCompleted` write through `@repo/learning` (assert events); `continue` returns the first incomplete required lesson and falls back to the first; unauthenticated learning mutation → `UNAUTHORIZED`; a learning mutation ignores any `userId` in input.
2. `@repo/env`: missing `DATABASE_URL` fails validation; a GitHub id without a secret fails; defaults apply.
3. LMS components (jsdom): `mark-done-button` calls the mutation once and disables; `lesson-nav` prev/next around module boundaries; `course-card` renders duration and level.
4. Bundle budget script: fails on a fixture manifest over budget.
5. Browser loop on the dev server (`pnpm dev:lms`, real synced content, local Postgres), per the spec tracker's rule:
   - Routes: `/`, `/courses` (with filters), `/paths/ai-engineering`, `/courses/ai-engineering-foundations`, every lesson type in that course (article, video, exercise placeholder, quiz placeholder), `/sign-in`, `/sign-up`.
   - States: signed out (read freely, enrol prompts sign-in), signed in (enrol, mark done, video ended → completed, Continue advances, dashboard progress), empty dashboard (no enrolments), invalid sign-in, unknown course/lesson (404).
   - Viewports: desktop and 390px (sidebar collapses into the mobile nav, no horizontal scroll). Themes: light and dark.
   - Iterate: critique each screen against `DESIGN.md` and the acceptance criteria, fix, reload, repeat; at least two rounds, each recorded in `test.md` with what changed. Console clean on every load. Final screenshots saved and listed.
6. Existing suites and the full pipeline; CI adds the budget check.

## Out of scope

Quiz and exercise runners (S4), ratings (S6), certificates (S7), badges and streaks (S8), cohorts UI (S9), profile and settings pages, organization UI, search across companies (S14), email flows (S5; email verification is not required to enrol in S3).

## Acceptance criteria (from spec.md)

- [x] Visitor can browse and read free lessons without an account; enrolling prompts sign-in.
- [x] Video completion via player API records a `progress_events` row once.
- [x] Continue lands on the first incomplete required lesson.
- [x] Lesson page first-load JS is under the 300 KB ceiling (target 250 KB), measured on a production server, and renders at 360px with no horizontal scroll.
- [x] Browser loop passed on the dev server: catalogue, course, lesson, dashboard, sign-in; signed out and signed in; light and dark; desktop and 390px; at least two fix-and-reload iterations recorded in `test.md`.

## Open points for the founder

1. Sign-in and sign-up pages are pulled into S3 because the learner flows need them. They are minimal (email/password, social buttons). OK to include here rather than a separate spec?
2. Explicit "Mark as done" for articles versus auto-complete on scroll or time-on-page: the plan chooses explicit. Confirm.

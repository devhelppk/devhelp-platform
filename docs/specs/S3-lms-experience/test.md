# S3 test record

Date: 2026-09-06. Local Postgres 17, content pinned to `devhelppk/devhelp-content@46310df`, dev server `pnpm --filter lms dev` on :3001 for the browser loop, `next start` on :3101 for production checks.

## Automated

| Suite                  | Tests       | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@repo/api` (Postgres) | 7           | catalogue filters exclude archived/unpublished and count lessons; course detail ordering; unauthenticated mutation → `UNAUTHORIZED`; enrol → start → progress tick → complete writes through `@repo/learning` (events asserted) and `continue` advances then falls back to the first lesson; quiz lessons refuse the view-completion path; `userId` in input is ignored (session wins); unknown/archived courses → `NOT_FOUND`; drop → re-enrol → complete again succeeds (generation-scoped keys) and dropped enrolments are hidden; `listPaths` and `getPath` apply the same visibility filter |
| `@repo/env`            | 4           | defaults, missing `DATABASE_URL`, short secret, empty optional → undefined, OAuth pairs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `@repo/learning`       | 17 (+1)     | S1 suite plus a real pool assertion: `DATABASE_POOL_MAX ≥ 2` and two parallel `pg_sleep(0.3)` finish in < 550 ms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `lms` (jsdom)          | 5           | `CourseCard` (link, badges, duration, progressbar), `formatDuration`, `neighbours`, `LessonList` (current + completed + optional), `safeCallback` rejects off-origin                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `scripts`              | 1           | budget script fails a heavy page and a missing page, passes a light one (local HTTP fixture)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Repo pipeline          | 34/34 tasks | `format && lint && check-types && test && build`, `format:check` clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Bundle budget (production server)

| Page                                          | First-load JS (gz) | Target / ceiling |
| --------------------------------------------- | ------------------ | ---------------- |
| `/courses/ai-engineering-foundations/welcome` | 222.4 KB           | 250 / 300        |
| `/courses`                                    | 189.7 KB           | 250 / 300        |
| `/`                                           | 189.7 KB           | 250 / 300        |

Baseline (empty route, Next 16 + React + theme): ~172 KB. Before the layout diet the lesson page was 272 KB: the root layout shipped the tRPC provider, a tooltip provider, the Better Auth client, and a Radix dropdown to every page. Fixes: providers scoped to learner pages, server-rendered `<details>` account menu with a server-action sign-out, session state passed as props, toaster and mobile sheet loaded after hydration. The original 150 KB in N1.1 was below the framework floor; the founder set target 250 / ceiling 300 during implementation.

## Browser loop (Chrome, dev server, real content)

Routes covered: `/`, `/courses` (+ filters), `/paths/ai-engineering`, `/courses/ai-engineering-foundations`, lessons `welcome` (article), `how-agents-work` (video), `the-daily-update` (article with code block), `/sign-up`, `/sign-in`, `/courses/does-not-exist`. States: signed out (read freely, "Sign in to enrol", "Sign in to track progress"), signed in (enrol → first lesson, mark done → toast + next lesson + sidebar tick, video played to the end → "Completed." + course 50%, dashboard Continue card and progress), invalid sign-in (inline error), 404. Themes: light and dark. Viewports: 1400/1568 wide and the narrowest Chrome allows (500 px; 390 px is below Chrome's minimum window width on this machine, so the mobile layout was verified at 500 px with `scrollWidth <= innerWidth` asserted on every page). Console: clean on every page except one dev-only warning on the default Next 404 page before the branded page existed.

Round 1 found: "1 lessons" pluralisation; sidebar lesson titles truncated to "Welcome to …" because the type/duration label took the width; lesson bodies missing in dev (Content Collections resolved the content directory against the config file and was fed an absolute path, so 0 documents compiled; the production build had the same bug); dashboard cards read "0 lessons"; the video box was blank until the YouTube script loaded; the default Next 404 page (unbranded, dev console warning).
Round 1 fixes: pluralisation; compact sidebar hides the label and wraps titles; content directory resolved from the workspace root and passed relative to the config; lesson count optional on cards; poster image behind the player; branded `not-found.tsx`.

Round 2 found: code blocks labelled "code" because Shiki emits no language attribute; the sidebar tick did not appear after a video completed until reload.
Round 2 fixes: a Shiki transformer sets `data-language` on `<pre>`; the player calls `router.refresh()` on completion.

Round 4 (after code review): on the dev server, marking the last lesson of a course done now flips the button to "Done", shows the Completed badge and sidebar tick, and toasts "Course completed" without a reload (review finding 6); console clean.

Round 3: re-verified all routes in both themes and at the narrow viewport; final screenshots saved (below). Database after the loop: `course_enrolled` 1, `lesson_started` 1, `lesson_completed` 2, both lessons `completed`, enrolment `active` at 50%.

Screenshots (`docs/specs/S3-lms-experience/screenshots/`): `catalogue-light-desktop.jpg`, `course-light-desktop.jpg`, `lesson-video-light-desktop.jpg`, `dashboard-light-desktop.jpg`, `dashboard-dark-desktop.jpg`, `lesson-code-dark-desktop.jpg`, `lesson-dark-mobile.jpg`, `dashboard-dark-mobile.jpg`.

## Production checks

Built LMS on :3101: branded 404 returns HTTP 404 with the new page; lesson body renders from compiled MDX; budget check passes (table above). Marketing site builds with `typedRoutes` and env-based links.

## Known limits

- The sample video in the content repo is a placeholder (`dQw4w9WgXcQ`); swap it for a real lesson video in `devhelp-content`.
- `/courses` renders dynamically because it reads `searchParams`; the plan's "static with revalidation" applies to path and course pages only.
- The mobile check ran at 500 px, not 390 px (Chrome window minimum on this machine); layout uses fluid widths with no fixed columns below `lg`, and no horizontal overflow was measured.

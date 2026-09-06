# S4 test record

Date: 2026-09-06. Local Postgres 17, content pinned to `devhelppk/devhelp-content@ac9e266` (adds the Python exercise `count-words` and the multi/short questions on `foundations-check`), dev server `pnpm --filter lms dev` on :3001 for the browser loop, `next start` on :3002 for the production budget check.

## Automated

| Suite                   | Tests     | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@repo/exercise-runner` | 5         | harness: `describe`/`it`/`expect` matchers (`toBe`, `toEqual`, `toMatchObject`, `toThrow`, `toContain`, `resolves`/`rejects`), TypeScript transpile through Sucrase, module table (`../starter/*` from `tests/*`), `vi.fn`, a failing assertion reports `expected … to be …`, an unused import is elided without error                                                                                                                           |
| `@repo/content-schema`  | 10 (+1)   | S2 suite plus the `parity` rule: a fixture whose tests use a matcher outside the runner subset fails `content:check`; Python starters are syntax-checked only (no "starter already passes" warning)                                                                                                                                                                                                                                              |
| `@repo/api` (Postgres)  | 14 (+5)   | `getQuiz` returns no `isCorrect`/`answer`/`feedback`/`explanation`; `submitQuiz` grades single, multi (exact set) and short (normalised, accepted list), stores the snapshot with question versions, records `quiz_attempted`, completes the lesson on pass and refuses further attempts past `maxAttempts`; `submitExercise` rejects an inconsistent `passed`, stores files + results, completes on pass only; unauthenticated → `UNAUTHORIZED` |
| `@repo/learning`        | 17        | S1 suite; `quizScoreFacts` feeds `minQuizScore` in the reducer                                                                                                                                                                                                                                                                                                                                                                                   |
| `@repo/content`         | 9         | S2 sync suite (exercise and quiz metadata, including `runner` and question versions)                                                                                                                                                                                                                                                                                                                                                             |
| Repo pipeline           | all tasks | `format && lint && check-types && test && build` green; `format:check` clean                                                                                                                                                                                                                                                                                                                                                                     |

## Bundle budget (production server)

| Page                                                    | First-load JS (gz) | Target / ceiling |
| ------------------------------------------------------- | ------------------ | ---------------- |
| `/courses/ai-engineering-foundations/welcome`           | 224.5 KB           | 250 / 300        |
| `/courses/ai-engineering-foundations/foundations-check` | 224.5 KB           | 250 / 300        |
| `/courses/ai-engineering-foundations/trace-the-refund`  | 224.5 KB           | 250 / 300        |
| `/courses`                                              | 191.2 KB           | 250 / 300        |
| `/`                                                     | 191.2 KB           | 250 / 300        |

Quiz and exercise pages cost the same as an article on first load: the assessment island is a `next/dynamic` (`ssr: false`) import, so CodeMirror, Sucrase and the runner workers arrive only after hydration, and Pyodide (~10 MB, CDN, pinned 0.29.4) only inside the Python worker. Network log on the TypeScript exercise shows no `pyodide` request.

## Answer secrecy

`GET /api/trpc/assessments.getQuiz` for `foundations-check` (1.4 KB) contains `quizId`, `passScore`, `maxAttempts`, `version` and questions with `id`, `type`, `prompt`, `points`, `options[{id,text}]` only. Grepping the response and the server-rendered page (HTML + RSC payload) for `isCorrect`, `acceptedAnswers`, and the feedback/explanation strings finds nothing. Feedback appears only in `submitQuiz` results after grading.

## Browser loop (Chrome, dev server, real content)

Routes: `/courses/ai-engineering-foundations/foundations-check` (quiz: single, multi, short), `/trace-the-refund` (TypeScript exercise), `/count-words` (Python exercise), `/welcome` (article, for the wider column). States: signed in as the S3 loop learner (fail then pass on the quiz, edit → run → fail → fix → pass → submit on both exercises, draft restore after reload, reset to starter), signed out (quiz form renders with "Sign in to take the quiz"; exercises run in the browser and show "Sign in to record this" on a pass). Themes: light and dark. Viewports: 1568 and 500 px (Chrome's minimum window width here; `scrollWidth <= innerWidth` asserted on every page). Console: clean on every load.

Round 1 found: the exercise layout put the editor and the tests side by side, and the grid stretched the editor column to the taller tests pane, leaving a large empty area under short starter files; a bare Python `assert` failure showed only "AssertionError" with nothing to act on.
Round 1 fixes: both panes capped (`maxHeight` on the editor, `items-start` on the grid); the Python collector now reports the failing line, e.g. `AssertionError at line 13: assert count_words("") == {}`.

Round 2 (founder review on the dev server): two editors side by side felt cramped; the lesson column left too much empty space either side; the header breadcrumb did not sit on the same line as the wordmark.
Round 2 fixes: one editor with file tabs, test files as read-only tabs (lock icon, note under the editor), results below; `AppShellContent` widened to `max-w-4xl` and quiz/exercise lessons to `max-w-5xl` (prose keeps its 65ch measure); the header groups the wordmark and breadcrumb with a divider and chevron on one baseline (`leading-none`), titles truncate at narrow widths. Re-verified: tab switch keeps edits (editable `refund.ts` doc unchanged after viewing `refund.test.ts`), light and dark, 500 px with no horizontal overflow, TypeScript run 5/5 signed out, Python run and draft restore.

Round 3 (after code review, see `review.md`): the production build had emitted the Python worker as a raw `.ts` asset (classic worker), so Python exercises would have failed after deploy. Both workers are module workers now and Pyodide loads through its ESM build. Re-verified on the dev server (TypeScript 5/5 in 8 ms after the fix; Python 1/4 with the failing lines reported) and on a production server on :3002 (`count-words` 1/4 in 12 ms, `trace-the-refund` 3/5 in 15 ms from the starter). The semantic pass/fail colours, sentence-style meta strings, and sans-serif file tabs were checked on the dev server in both themes.

Database after the loop (loop learner): `quiz_attempts` 2 (attempt 1 score 0 failed, attempt 2 score 100 passed, both with a 4-question snapshot at quiz version 3), `exercise_submissions` 2 (TypeScript 5/5 in 9 ms, Python 4/4 in 35 ms, both passed), events `quiz_attempted` 2, `exercise_submitted` 2, `lesson_completed` +2, `course_completed` recorded when the quiz passed (it was the last required lesson); enrolment `completed` at 100%.

Screenshots (`docs/specs/S4-quizzes-exercises/screenshots/`, captured signed out after round 2): `quiz-light-desktop.jpg`, `quiz-dark-desktop.jpg`, `quiz-light-mobile.jpg`, `quiz-dark-mobile.jpg`, `exercise-light-desktop.jpg`, `exercise-dark-desktop.jpg`, `exercise-dark-mobile.jpg`, `exercise-python-light-desktop.jpg`, `exercise-python-dark-desktop.jpg`. The signed-in states (feedback per question, attempts list, "Recorded. Lesson completed.", sidebar ticks) were verified live in the loop.

Post-landing (founder decision, same day): exercises are JavaScript/TypeScript only. The Python runner and the `count-words` content exercise were removed; the Python screenshots were deleted, the TypeScript exercise was re-verified on the dev server after the removal, and the sync archived the Python lesson.

## Known gaps

- The quiz description in content still says "Two questions" while the quiz has four (content repo copy fix).
- Signed-out screenshots only: the loop account was signed out to verify the signed-out states and the session was not restored afterwards.
- Pyodide caching was observed (no runtime notice and a 20 ms run on reload) but not measured; worker fetches are not visible to the page-level network log.

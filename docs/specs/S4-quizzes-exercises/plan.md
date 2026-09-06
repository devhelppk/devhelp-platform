# S4 plan: quizzes and exercises

Status: `planned`, awaiting founder approval. Spec entry: `docs/spec.md` → S4. Requirements: F1.5, F1.6, F1.11 (completion rules `quiz_pass`, `exercise_pass`), F1.13; X10. Builds on S1 (`quizzes`, `questions`, `exercises` tables, `evaluateCompletion` with `minQuizScore` reserved), S2 (quiz YAML and exercise files synced from content), S3 (lesson page, tRPC, progress islands).

## Goal

A learner can take a quiz and get graded without the answers ever reaching the browser, and can solve a coding exercise in the browser with tests that decide pass or fail. Both record through the progress engine and complete their lessons under the `quiz_pass` and `exercise_pass` rules. Runners load on demand so lesson pages stay within budget.

## Decisions (verified 2026-09-06)

1. **Quizzes are graded on the server** in a tRPC mutation (`learning.submitQuiz`). The client receives questions through `questionPublicColumns` + `toPublicOptions` (S1) and never sees `isCorrect`, `answer`, or `explanation` until after submitting. Grading: `single` = the one correct option; `multi` = exact set match; `short` = case-insensitive, whitespace-trimmed match against the accepted answers. Score = earned points / total points × 100; pass when `score ≥ quizzes.pass_score`. `max_attempts` enforced server-side; `shuffle` applied server-side with the order returned to the client.
2. **`quiz_attempts` stores a question-version snapshot** (`{ questionId, version, answer, correct, points }[]`) so regrading after a content change is possible and history stays honest when a quiz is re-synced. Best score per quiz feeds `evaluateCompletion` (`minQuizScore`, reserved in S1) through `@repo/learning`.
3. **JavaScript and TypeScript exercises run in a Web Worker with our own harness, not Sandpack.** `@codesandbox/sandpack-react` has had no push since 2025-04 (17 months) and its test runner talks to a remote bundler. Instead: `packages/exercise-runner` (`@repo/exercise-runner`) transpiles each file with **Sucrase** (`typescript` + `imports` transforms, ~200 KB, last push 2025-11, does one job) inside a Worker, resolves relative imports across the exercise's files with a tiny module table, maps `import … from "vitest"` to a built-in harness (`describe`, `it`, `test`, `expect` with `toBe`, `toEqual`, `toStrictEqual`, `toMatchObject`, `toContain`, `toHaveLength`, `toBeTruthy/Falsy`, `toBeNull`, `toBeUndefined`, `toBeGreaterThan/LessThan`, `toThrow`, `not`, `resolves`/`rejects`), runs with a 5 s timeout, and posts structured results (`{ name, passed, error? }[]`). Console output is captured and shown. This is the same subset already used by the content repo's tests.
4. **The same harness runs in Node for `content:check`.** The checker keeps running real vitest against `solution/` (S2) and additionally runs the browser harness on `solution/` and `starter/`, so any test feature outside the subset fails at content-check time, never in a learner's browser. Parity is a test, not a hope.
5. **Python exercises run on Pyodide in a Worker**, loaded from the jsDelivr CDN at a pinned version (currently 0.29.x; the npm `latest` tag now points at a differently versioned build, so the plan pins the CDN URL and verifies at implementation). Tests are plain Python files whose top-level `test_*` functions use `assert`; a small runner collects them, executes each, and reports pass/fail with the assertion message. The runtime (~10 MB) downloads only when a Python exercise mounts and is cached by the browser.
6. **Editor: CodeMirror 6** through `@uiw/react-codemirror` (maintained, last push 2026-07) with `@codemirror/lang-javascript` and `@codemirror/lang-python`, one tab per starter file, theme bound to the design tokens (light and dark), reset-to-starter, and local draft persistence in `localStorage` keyed by exercise id and version so a reload does not lose work.
7. **Pass/fail is computed client-side and recorded server-side with the submitted files and results** (F1.5). `learning.submitExercise` stores `exercise_submissions` (files, results, passed, runner, exercise version) and, when passed, completes the lesson. The server does not execute learner code. This is honest about trust: the platform is free and the signal that matters to employers is the reviewed project (S8) and the certificate criteria (S7), which can require an accepted project. Documented in `requirements.md` as a note on F1.5.
8. **Events:** every quiz submission records `quiz_attempted` and every exercise run that is submitted records `exercise_submitted` (payload: score or pass/fail, attempt number, version). Passing records `lesson_completed` with the enrolment generation key (S3 convention), through `recordEvent`, so the course recompute and `course_completed` follow the S1 path.
9. **Runners are loaded on demand** with `next/dynamic` (`ssr: false`); the lesson page's first-load JS stays unchanged. The Worker bundles (harness + Sucrase; Pyodide loader) are separate chunks. Budget check adds the quiz and exercise lesson URLs with the same 300 KB ceiling for the page shell.
10. **Attempt history is visible:** the quiz shows previous attempts (score, date) and the best score; the exercise shows the last result and lets the learner re-run freely. `max_attempts` is enforced for quizzes only.
11. **Schema (migration `0003_assessment_attempts`):**
    - `quiz_attempts`: `id`, `user_id`, `quiz_id`, `lesson_id`, `attempt` (int, per user+quiz), `answers` jsonb (validated: `{ questionId, value: string | string[] }[]`), `snapshot` jsonb (per question: id, version, correct, points, earned), `score` smallint, `passed` bool, `quiz_version`, `started_at`, `submitted_at`. Unique `(user_id, quiz_id, attempt)`; index `(user_id, lesson_id)`.
    - `exercise_submissions`: `id`, `user_id`, `exercise_id`, `lesson_id`, `attempt`, `files` jsonb (`FileMap`), `results` jsonb (`{ name, passed, error? }[]`), `passed` bool, `runner`, `exercise_version`, `duration_ms`, `submitted_at`. Unique `(user_id, exercise_id, attempt)`; index `(user_id, lesson_id)`.
    - Zod schemas for all three jsonb shapes in `packages/database/src/schema/json.ts` (X10).
12. **`@repo/learning` gains `quizScoreFacts(userId, courseId)`** (best score per quiz, averaged) used by `recomputeCourse` when `completion_criteria.minQuizScore` is set, closing the S1 placeholder; `requireProjectAccepted` stays for S8.

## Alternatives considered for the JS/TS runner (verified 2026-09-06)

| Option                                                            | State                                                                  | Why not                                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `codesandbox/sandpack` (Apache-2.0, 6.2k)                         | last push 2025-04-24                                                   | Unmaintained for 17 months; tests run through a remote bundler.                                                                |
| StackBlitz WebContainers (`@webcontainer/api` 1.6, core repo MIT) | repo last push 2025-04-22; runtime proprietary, "free for open source" | Full Node in the browser needs COOP/COEP headers and is heavy on low-RAM phones; licence is a promise, not code.               |
| `@codesandbox/nodebox`                                            | last publish 2025-04                                                   | Same fate as Sandpack.                                                                                                         |
| LiveCodes (MIT, 1.5k, active)                                     | full playground app embedded by iframe                                 | An IDE, not a widget: megabytes of JS, its own UI and theme, tests are a playground feature rather than a contract we control. |
| Codapi (`codapi-js`, MIT, active)                                 | runs snippets in-browser for JS/Python or via a Codapi server          | Output runner, no test harness; the server mode contradicts "no server-side execution".                                        |
| Runno (MIT, 772, active)                                          | WASI runtimes (Python, Ruby, C, Rust, QuickJS) as a web component      | Program runner with stdin/stdout, no test harness or TS; the right building block if we add compiled languages later.          |
| `quickjs-emscripten` (active)                                     | sandboxed JS interpreter in wasm                                       | Interpreter only; useful as an isolation layer if learner code ever runs outside a Worker.                                     |

Conclusion: keep decision 3. The harness is ~300 lines we own, on Sucrase plus a Worker; Runno is the noted path for languages beyond JS/TS/Python.

## API (`packages/api`, `learning` router)

```
getQuiz({ courseSlug, lessonSlug })            public: questions through questionPublicColumns, shuffled if configured; attempts so far and best score for the session user
submitQuiz({ courseSlug, lessonSlug, answers })  protected: grades, stores quiz_attempts, records quiz_attempted (+ lesson_completed on pass), returns { score, passed, perQuestion: [{ questionId, correct, correctOptionIds | acceptedAnswers, feedback, explanation }], attemptsLeft }
getExercise({ courseSlug, lessonSlug })        public: runner, language, entry, starterFiles, testFiles (tests are shown to learners: that is the exercise contract), instructions; last submission for the session user
submitExercise({ courseSlug, lessonSlug, files, results, passed, durationMs })  protected: validates shapes, stores exercise_submissions, records exercise_submitted (+ lesson_completed on pass)
```

Answers, `isCorrect`, and explanations appear only in `submitQuiz`'s response for the questions just answered. Inputs are Zod; outputs inferred.

## `packages/exercise-runner`

- `src/harness.ts`: the vitest-subset test API and reporter (pure, no DOM), used by both the Worker and Node.
- `src/js-runner.ts`: `runJs({ files, testFiles, entry, timeoutMs })` → transpile with Sucrase, evaluate in a module table, execute tests, return results. In the browser this runs inside `src/js.worker.ts`; in Node (`content:check`) it runs directly with a `vm` context.
- `src/py-runner.ts` + `src/py.worker.ts`: load Pyodide (pinned CDN), write files to its FS, run the test collector, return results.
- `src/index.ts`: `createRunner(kind)` returning `{ run(files): Promise<Results>, terminate() }` backed by a Worker in the browser.
- Tests: harness matchers; a passing and a failing JS exercise; a TS exercise with a relative import; a timeout (infinite loop) is reported, not hung; the content repo's `trace-the-refund` passes on `solution/` and fails on `starter/` through the harness.

## UI (`apps/lms/components/assessment`)

- `quiz.tsx` (client, loaded on demand): one question per card, radio for `single`, checkboxes for `multi`, text input for `short`; submit; per-question result with feedback and explanation; score, pass/fail, attempts left; retry when allowed; previous attempts list. Keyboard-operable, `aria-live` results.
- `exercise.tsx` (client, on demand): instructions (compiled MDX from the exercise README, S2), CodeMirror tabs, test list, "Run tests" (runs locally, no server call), "Submit" (enabled after a run; records the result), reset, run timing, last-result banner. Python shows a one-time "loading Python runtime (~10 MB)" notice.
- Lesson page: replaces the S3 placeholders for `quiz` and `exercise` types; `project` keeps its placeholder until S8.
- Design: reuse `Card`, `Badge`, `Button`, `Progress`; code panes use the design system's mono face and the Shiki theme variables so the editor matches highlighted code blocks.

## Content repo

- `content:check` gains the parity run (decision 4). Existing fixtures already carry a JS exercise; add one Python exercise (`starter/`, `solution/`, `tests/test_*.py`) to `devhelp-content` so the Python path is exercised end to end, plus a `multi` and a `short` question in the sample quiz.

## Files

- New: `packages/exercise-runner/**`, `packages/database/src/schema/assessments.ts` additions + `json.ts` schemas, `packages/database/drizzle/0003_assessment_attempts.sql`, `packages/learning/src/quiz-facts.ts`, `packages/api/src/routers/learning.ts` additions (or `assessments.ts` router), `apps/lms/components/assessment/**`, `apps/lms/app/courses/[course]/[lesson]/assessment.tsx` (dynamic loader), workers wiring in `next.config.ts` if needed.
- Changed: lesson page, `packages/content-schema/src/check.ts` (parity run), `scripts/check-bundle-budget.ts` (quiz and exercise URLs), `docs/data-model.md`, `docs/requirements.md` (F1.5 trust note), `AGENTS.md`.
- Content repo: Python exercise, richer quiz.

## Tests

1. Grading (unit, `packages/api` or `packages/learning`): single/multi/short correctness, partial credit by points, pass threshold, max attempts, snapshot shape, shuffle stability.
2. `submitQuiz` (Postgres): answers never in `getQuiz` output (assert on serialised payload); attempt numbering; pass records `quiz_attempted` + `lesson_completed` and completes a course whose criteria include `minQuizScore`; fail records only `quiz_attempted`; a re-synced quiz (new version) starts a fresh attempt series and old snapshots stay intact.
3. `submitExercise` (Postgres): stores files and results; pass completes the lesson; input validation rejects malformed results.
4. Runner (Node + jsdom): as listed under the package; Worker message protocol tested with a fake `Worker`.
5. Content check parity: `content:check` fails a fixture whose tests use a matcher outside the subset.
6. Browser loop on the dev server (spec rule): routes `/courses/ai-engineering-foundations/foundations-check` (quiz) and `/courses/ai-engineering-foundations/trace-the-refund` (exercise) plus the new Python exercise; states: signed out (can read and run, cannot submit), signed in (fail then pass on the quiz with feedback, attempts left; edit code, run, fail, fix, pass, submit → lesson tick, course progress), max-attempts reached, Python runtime loading and running; light and dark; desktop and narrow; console clean; at least two iterations recorded; screenshots saved.
7. Budget: quiz and exercise lesson pages under the ceiling before the runner chunk loads.

## Out of scope

Project submissions and mentor review (S8), peer review, server-side execution of learner code, exercise hints or AI assistance, code persistence across devices (drafts are local), exercises in languages other than JS/TS/Python.

## Acceptance criteria (from spec.md)

- [ ] Correct answers never reach the client (checked via network tab and a test on the RSC payload).
- [ ] Quiz attempt stores the question version snapshot; regrading after a content change is possible.
- [ ] A passing exercise records an event with the submitted code; a failing one does not complete the lesson.
- [ ] Pyodide loads only on Python exercises and is cached (second load is instant).
- [ ] Browser loop passed on the dev server for quiz and exercise lessons (both runners), signed out and in, light and dark, desktop and narrow; at least two fix-and-reload iterations recorded in `test.md`.

## Open points for the founder

1. Sandpack is dropped in favour of our own Worker harness (decision 3). Founder: fine after the alternatives sweep above found no maintained equivalent.
2. Client-side pass/fail for exercises (decision 7) is recorded, not verified. Founder: acceptable; decide on server-side verification before certificates (recorded in `spec.md` follow-ups, to be settled at the end of this spec).

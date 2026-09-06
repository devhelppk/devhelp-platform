# S6 plan: ratings, course reviews, and discussions

Status: `done` (see `review.md`, `test.md`). Deviations after implementation and review: `comments.list` and `reviews.mine` read role and verification from the users table (the S5 rule); comment edits re-run the hold check and refresh the queue snapshot; a deleted comment is never changed by a moderation decision; `reply_count` is recounted from source rather than incremented; pagination is a keyset cursor on (votes, created_at); the `anchor` column exists without UI. Founder confirmed the four open points on 2026-09-06. Spec entry: `docs/spec.md` → S6 (absorbs the former S12 "Comments and Q&A"; the founder asked for general discussion on lessons and courses alongside ratings). Requirements: area 4 in full: F4.1 to F4.7, N4.1 to N4.3; F3.8 inputs (revision signals); X10. Builds on S3 (lesson and course pages, tRPC islands), S4 (completion moments), S5 (moderation queue, flags, notifications, `verifiedProcedure`, `rateLimit`).

## Goal

Three learner signals on one page model. A learner rates a lesson in two taps at the moment they finish it, reviews a course once they are half way through, and can ask, answer, and discuss under any lesson or course. Mentors answer and accept, readers upvote and flag, and every aggregate a mentor needs (average, unclear rate, open questions) is a column that updates on write. Discussion never slows the lesson body down and never appears in search engines before a moderator has seen it.

## Decisions (verified 2026-09-06)

1. **Lesson feedback is private and inline.** `lesson_feedback` (one row per user and lesson: `rating` 1–5, `tags` text[] from `unclear, too_long, outdated, error, loved_it`, `text` ≤ 500, `updatedAt`). A `LessonFeedback` island appears in the completion moment: after "Mark as done", a passed quiz, or a recorded exercise, the button area turns into "How was this lesson?" with five stars and the tag chips; text is a second step. Editable any time from the same spot. Feedback is never shown to other learners; it feeds aggregates and the S11 mentor dashboard. Zero client JS on the lesson page beyond the island that already exists there.
2. **Course reviews are public, one per learner, gated on progress.** `course_reviews` (`userId`, `courseId`, `rating`, `title` ≤ 80, `body` ≤ 2000, `progressAtReview` smallint, `completedAtReview` bool, `status` visible/hidden, `helpfulCount`, timestamps). The form appears on the course page at ≥ 50 percent (`enrollments.progress_percent`) and shows a "Completed" badge when the reviewer finished. Reviews publish at once (post-moderation: flaggable, hideable through S5), because a course review carries no defamation risk of the company-bank kind; N2.1's pre-moderation rule stays with area 2.
3. **Discussions are comments on a subject.** `comments` (`subjectType` enum `lesson | course`, `subjectId`, `parentId` nullable, `authorId`, `kind` enum `question | note | answer` (answers are replies), `body` markdown ≤ 5000, `bodyHtml` rendered at write, `anchor` nullable heading id, `status` enum `visible | held | hidden | deleted`, `voteCount`, `replyCount`, `acceptedAt`, `acceptedBy`, `editedAt`, timestamps). One level deep (F4.3): a reply's parent must be a top-level comment. `comment_votes` (`commentId`, `userId`, unique) keep `voteCount` in step in the same transaction. `lesson_watchers` (`userId`, `lessonId`) lets a mentor follow a lesson's questions.
4. **Markdown is rendered on the server at write time, never trusted from the client.** `marked` 18.0 (GFM, maintained, 2026-08) renders the subset (paragraphs, emphasis, links, lists, inline code, fenced code, blockquotes), then `sanitize-html` 2.17 allow-lists tags and attributes, forces `rel="nofollow ugc"` and `target="_blank"` on links, and strips everything else. The result is stored in `bodyHtml` and re-rendered on edit. Preview is a `comments.preview` procedure, so no Markdown library ships to the browser. Code blocks get the lesson's `CodeBlock` styling by class, no Shiki (highlighting comment code is not worth a per-write Shiki run; revisit if mentors ask).
5. **Post-moderation with holds, through S5.** A comment is `visible` on write unless it contains a link and the author's account is younger than seven days (F4.5), or the author has a hidden comment in the last 30 days: then it is `held` and a `moderation_items` row with subject `comment` goes to the queue (track = the course's track). Approve makes it visible; reject hides it. Readers flag with the existing `moderation.flag` (subject `comment` or `course_review`); upholding a flag hides the comment through the S5 path. The moderation enums gain `comment` and `course_review`. Hidden and deleted comments keep their row (replies stay attached) and render as "removed".
6. **Accepted answers and sorting.** A mentor of the course's track or an admin can accept exactly one reply per question (`acceptedAt`, `acceptedBy`); accepting again moves the mark. Top-level order: accepted-answered questions are not pinned; within a thread the accepted reply is first, then votes, then recency; top-level sort is votes then recency with a "Newest" toggle. Questions with no replies and no accepted answer count as open (F4.6 `openQuestionCount`).
7. **Aggregates are columns updated in the writing transaction (N4.2).** Lessons: `ratingAvg`, `ratingCount` (existing), plus `unclearCount` and `openQuestionCount`. Courses: `ratingAvg`, `ratingCount` from course reviews, plus `reviewCount`. One `recomputeLessonAggregates(tx, lessonId)` and `recomputeCourseAggregates(tx, courseId)` in `@repo/learning` (they already own the read models) run after every feedback, review, comment, or accept write. No triggers: the Drizzle transaction is the boundary the repo already relies on.
8. **Notifications through `@repo/notify`.** Kinds: `comment_reply` (question author, and the parent author on a reply to their reply is out of scope: one level), `comment_accepted` (reply author), `lesson_question` (watchers of the lesson), `comment_held` (author, with the reason the moderator gives on decision through the existing `moderation_decided`). Immediate email only for `comment_accepted`; the rest wait for the digest (X4 P1), as S5 planned.
9. **Loading and indexing (N4.1, N4.3).** The lesson body is server-rendered as today; `Discussion` is a client island under `LessonNav`, loaded with `next/dynamic` after hydration and fetching `comments.list` through tRPC, so it cannot delay the body and its text is absent from the HTML that crawlers see. Course reviews are server-rendered on the course page (they are meant to be indexed). Search within a course over comments is S13 with X3.
10. **Rate limits and ownership.** `rateLimit`: 30 comments a day, 10 top-level questions a day, 60 votes an hour, one review per course (unique), one feedback per lesson (unique). Authors edit (sets `editedAt`, re-renders HTML, re-runs the hold check) and delete (soft) their own comments; mentors and admins hide through moderation only, so every removal is logged.
11. **Verified email to write, none to read.** All writes here use `verifiedProcedure` except lesson feedback and votes: feedback is private and low risk, and a vote is not content. Course reviews and comments need a verified email (X1).
12. **UI is server-first where the data is static and an island where it is personal.** Course page: reviews list (server) + `CourseReviewForm` island. Lesson page: `LessonFeedback` island in the completion slot; `Discussion` island (composer with Markdown hint and server preview, question/note toggle, list with reply, vote, accept, flag, edit, delete). Mentor "Watch this lesson" toggle in the discussion header. `/moderate` gains the `comment` and `course_review` subjects (payload snapshot renders the text). Account menu unchanged.

## Alternatives considered (verified 2026-09-06)

| Option                                       | Verdict                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Giscus / Utterances (GitHub Discussions)     | Needs a GitHub account to post and gives us no moderation, votes, or aggregates; wrong for learners in Pakistan who may not have GitHub yet. |
| Discourse / Flarum embedded                  | A second product to run and moderate; our need is one thread per lesson with our roles.                                                      |
| Client-side Markdown (`react-markdown` 10.1) | Ships a parser to every lesson page and trusts client rendering; server render at write time is smaller and safer.                           |
| `markdown-it` 15 instead of `marked`         | Equivalent; `marked` has the smaller API and no plugin system to police.                                                                     |
| Postgres triggers for aggregates             | Hide logic from the code and tests; the transaction boundary in `@repo/learning` is already the pattern.                                     |
| Pre-moderating every comment                 | Would kill discussion latency for a queue staffed by a few people; holds on links from new accounts plus flags match F4.5.                   |

## Schema (migration `0008_feedback_reviews_comments`)

- Enums: `feedback_tag`, `comment_subject` (lesson, course), `comment_kind` (question, note, answer), `comment_status` (visible, held, hidden, deleted), `course_review_status` (visible, hidden). Extend `moderation_subject` (+comment, +course_review) and `notification_kind` (+comment_reply, +comment_accepted, +lesson_question, +comment_held).
- Tables: `lesson_feedback`, `course_reviews`, `comments`, `comment_votes`, `lesson_watchers`. Columns added: `lessons.unclear_count`, `lessons.open_question_count`, `courses.review_count`.
- jsonb: `moderation_items.payload` union gains `comment` (`{ body, subjectType, subjectId, anchor }`) and `course_review` (`{ rating, title, body }`) in `json.ts`.

## API (`packages/api`)

- `feedback` router: `mine({ courseSlug, lessonSlug })`, `rate({ courseSlug, lessonSlug, rating, tags, text })` (upsert, recompute).
- `reviews` router: `list({ courseSlug, cursor })` (visible only), `mine`, `submit` (verified, ≥ 50 percent, upsert, recompute), `remove` (own).
- `comments` router: `list({ subjectType, slug…, sort, cursor })` with replies nested (visible plus the caller's own held ones, marked), `preview({ body })`, `create` (verified, hold check, rate limited, notifies), `edit`, `remove`, `vote({ id, on })`, `accept({ id })` (mentor of track or admin), `watch({ lessonSlug, on })`.
- `moderation.decide` gains the `comment` and `course_review` side effects (visible/hidden) in its transaction.

## Tests

1. `@repo/learning`: aggregate recompute (avg, counts, unclear rate, open questions) from fixtures.
2. `@repo/api` (Postgres): feedback upsert idempotent and aggregates move; review gated on 50 percent and once per course; comment create renders and sanitises Markdown (script tags, `javascript:` links, raw HTML stripped; links get `nofollow ugc`); hold on link from a 3-day-old account creates a moderation item and approve makes it visible; reply depth limited to one; vote toggles and counts; accept by track mentor allowed, other mentor refused, second accept moves; edit re-renders; delete soft; notifications to author, reply author, and watcher; unverified refused on write; rate limits.
3. `apps/lms` (jsdom): star and tag input, composer preview state, reply and vote rendering, "removed" placeholder.
4. Browser loop (spec rule), through the S5 Playwright harness plus Chrome: complete a lesson → feedback stars and tags → edit it; course page at < 50 percent (no form), at ≥ 50 percent (form) → review appears with badge; discussion: ask with a fenced code block → renders highlighted class → reply as another user → notification → upvote → mentor accepts → sort order → flag → hide from `/moderate` → "removed" placeholder; new account posts a link → held banner for the author, item in the queue, approve → visible; light and dark, desktop and 390 px, console clean, at least two fix-and-reload iterations, screenshots saved.
5. Bundle budget: lesson page first-load JS unchanged (islands load after hydration).

## Out of scope

Email digest (X4), search over comments (S13/X3), comment reactions beyond upvote, mention (@name) notifications, promoting an accepted answer into the lesson (needs the content pipeline; S11), moderator bulk actions.

## Acceptance criteria (from spec.md)

- [x] One rating per user per lesson, editable; aggregates recompute on write.
- [x] Course review form only appears at ≥ 50 percent completion; one review per learner per course, shown with a completion badge.
- [x] Unclear-tag rate, average rating, and open-question count are queryable per lesson (feeds S11).
- [x] Comments load after the lesson body (client island) and never block it; their text is not in the server HTML.
- [x] Threads are one level deep; accepted answer pins first in its thread; the question author is notified on replies.
- [x] Links from accounts younger than seven days are held for moderation; approve publishes, reject hides; readers can flag; every removal is logged.
- [x] Browser loop passed on the dev server for the flows in test item 4; at least two fix-and-reload iterations recorded in `test.md`.

## Open points for the founder

1. Course reviews publish immediately and are flaggable (decision 2), unlike company reviews which are pre-moderated. Confirm.
2. Lesson feedback stays private to mentors and admins (decision 1); learners never see each other's ratings on a lesson, only the course-level average and reviews. Confirm.
3. Who may accept an answer: mentors of the course's track and admins (decision 6). Confirm, or widen to the question's author as well (common on Q&A sites).
4. Discussion on courses as well as lessons (decision 3) means a course page has a thread too. Confirm, or keep threads on lessons only and let course pages show the review list alone.

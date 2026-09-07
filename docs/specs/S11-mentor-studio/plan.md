# S11. Mentor studio and dashboard

Scope: F3.3 (reshaped), F3.8, F3.9. The founder's answers on 2026-09-07 turned this from "mount Keystatic" into something more consequential: **the content repo stops owning metadata**. That is a change to the contract S2 set, so most of this plan is about making that cut safely.

## Decisions

Four settled with the founder on 2026-09-07.

1. **No Keystatic, and no lesson-body editing in the app.** Mentors edit course and lesson _metadata_ in the platform; the prose, quizzes, and exercises stay a pull request on `devhelp-content`. This drops a pre-1.0 CMS, a GitHub OAuth app, and a second copy of the content schema that would have had to be kept in step by hand.

2. **A clean cut: metadata leaves the repo.** Lesson frontmatter and `course.yaml` keep only what identifies and structures the content. Title, summary, description, level, duration, cover image, and publish state exist only in Postgres. The founder chose this over "seed on create" knowing the cost: a newly synced course arrives unlabelled and stays invisible until someone fills it in.

3. **Credits are rows pointing at users.** `authors` and `reviewers` leave the YAML and become `content_credits` with a foreign key to `users`. The founder chose registered-only over a nullable link, knowing that an outside contributor cannot be credited until they have an account.

4. **The dashboard starts with our own signals.** Lessons below a rating threshold, above an unclear-tag rate, or with unresolved questions — all collected by S6 and currently read by nobody. GitHub issues wait until there is a GitHub integration to hang them on.

## The cut, precisely

The repo owns **what the content is**. Postgres owns **how it is described**.

| Stays in `devhelp-content`                                                               | Moves to Postgres                                                             |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The MDX body; quiz and exercise files; the solution and test files                       | `title`, `summary`, `description`                                             |
| Slug (the directory name) and structure: which lessons, in which module, in what order   | `level`, `track`, `coverImageUrl`, `estimatedHours`                           |
| `type` and `completionRule` — what kind of lesson this is, which the files have to match | `durationMinutes`, `isRequired`, `isFree`, `mode`, `videoProvider`, `videoId` |
| Quiz answers, exercise tests, `minQuizScore` and the rest of `completionCriteria`        | `isPublished` / `publishedAt`                                                 |
|                                                                                          | Module and course titles; `authors` and `reviewers` as `content_credits`      |

`type` and `completionRule` stay because they are claims about the files: a quiz lesson without a quiz file is a broken checkout, and `content:check` already enforces that. Titles are not.

**The sequencing is what makes this safe.** Every value being moved is already in Postgres, put there by the sync. So: stop the sync writing those columns first, ship that, then strip the repo. No data migration, and no window where the catalogue is unlabelled. `content:check` gains a rule that fails on a metadata key that no longer means anything, so nobody edits a title in YAML and wonders why nothing happened.

The one genuinely new state is a course that syncs before anyone has described it. It arrives `isPublished = false` with the slug as a placeholder title and appears in the studio's "needs metadata" list. It cannot reach the catalogue by accident, because publishing is now a decision someone makes in the app.

## Schema

Migration `0017_content_metadata`.

- `content_credits`: `id`, `subjectType` (`course` | `lesson`), `subjectId`, `userId` (FK), `role` (`author` | `reviewer`), `position`, `createdAt`. Unique on (subject, user, role).
- `content_edits`: an append-only record of who changed which field on what, and from what to what — the same shape as `moderation_actions`, because "a mentor changed the title of a published lesson" deserves the same trail as a moderation decision.
- `courses.needs_metadata` and `lessons.needs_metadata`, set by the sync on insert and cleared when someone saves the metadata form.

## API

- `studio.courses` / `studio.lessons`: what a mentor may edit, with the signals attached so the list can lead with what needs attention.
- `studio.updateCourse` / `studio.updateLesson`: `mentorProcedure`, Zod-validated per field, writing a `content_edits` row in the same transaction as the change.
- `studio.setCredits`: add or remove an author or reviewer, resolving a devhelp user.
- `studio.signals`: lessons below the rating threshold, above the unclear rate, with unresolved questions, and courses with no metadata yet.
- `contributors.list`: public, for the contributors page.

## Pages

- `/studio` — the mentor's list: what needs metadata, what the signals flag, and a search. Mentors and admins only, role read fresh.
- `/studio/courses/[slug]` and `/studio/lessons/[id]` — the metadata forms, with the credit editor and the recent edit history.
- `/contributors` — public, everyone credited and what they worked on.
- A byline on each lesson and course page, linking a credited mentor to their public profile.

## Tests

1. `@repo/content` (Postgres): a sync over content whose metadata has been stripped leaves existing titles alone; a new course arrives `needs_metadata` and unpublished; a metadata key left in YAML fails `content:check`.
2. `@repo/api` (Postgres): a mentor edits metadata and the edit is recorded with before and after; a learner cannot; publishing requires the metadata to be complete; credits resolve to users and refuse an unknown one; the signals query returns the lessons S6 flagged.
3. LMS (jsdom): the byline renders, and renders nothing when a lesson has no credits.
4. Browser loop: the studio list, both forms, the contributors page, and a lesson byline, in both themes at both widths.

## Out of scope

Lesson-body editing, Keystatic, GitHub issues on the dashboard, the project review queue (deferred with S8's scope change), and media upload. Reordering lessons stays a content PR, because order is structure.

## Risks

- **This changes what a content PR can do.** A contributor who edits a title in YAML after the cut gets a failing check rather than a silent no-op, which is the right failure but a new one. The content repo's README has to say where metadata lives now.
- **`content_hash` covers frontmatter**, so stripping it changes every hash and the first sync after the cut rewrites `content_revision_id` for everything. Harmless, but it will look like a large diff.
- **Two specs in one.** The ownership move and the dashboard are independent; if the move proves hairy, the dashboard and attribution can ship first as S11a and the cut follow as S11b.

## Acceptance criteria

- [ ] A mentor edits a course and a lesson's metadata in the app, and a later `content:sync` does not undo it.
- [ ] A metadata key left in the content repo fails `content:check` with a message naming where that field lives now.
- [ ] A newly synced course is unpublished, listed as needing metadata, and cannot appear in the catalogue until someone completes it.
- [ ] Every metadata change is attributable: who, what, before, after.
- [ ] Credits are users; a lesson byline and `/contributors` render from them.
- [ ] The dashboard lists lessons below the rating threshold or above the unclear-tag rate, from S6's existing signals.
- [ ] Browser loop passed, at least two fix-and-reload iterations recorded in `test.md`.

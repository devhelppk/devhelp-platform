# S8 plan: badges and streaks

Status: `planned`; founder answered the open points on 2026-09-06 (decisions 7, 4, 5, 6 confirmed; decision 8 reversed: no CI failure, and `first_project_accepted` stays earnable through automated checks; notification limits added as decision 13; leaderboards revisitable). Spec entry: `docs/spec.md` → S8. Requirements: F1.16, F1.17, F1.13 (streaks and activity computed from the event stream); X5 (badges on the public profile); X10. Builds on S1 (`progress_events`, the reducer and `rebuildLearner`), S2 (`badges/*.yaml` already has a schema and two definitions in the content repo), S5 (notifications, admin role), S7 (public profile with a slot waiting for badges).

## Goal

The platform notices what a learner has done and says so. Finishing five lessons in a week earns a badge without anyone deciding it; a streak and a year of activity show on the dashboard and, if the learner opts in, on their public profile. Everything is derived from the event stream, so it is honest by construction and survives a replay.

## Decisions (verified 2026-09-06)

1. **Badges are content, synced like everything else.** `badges/<slug>.yaml` already validates against `badgeFile` in `@repo/content-schema` (slug, name, description, icon, rule) and two badges exist in the content repo. S8 adds a `badges` table and a sync step, so a badge is created, updated, and archived by `content:sync` exactly like a course. `SyncSummary` gains `badges`.
2. **Rules are evaluated in the transaction that records the event.** `evaluateBadges(tx, userId, event)` runs inside `applyEvent`, after the read models move, and considers only the rules an event of that kind can satisfy (a `lesson_completed` cannot earn a `course_completed` badge; the derived `course_completed` event earns that one). Awards insert into `user_badges` with `onConflictDoNothing` on `(user_id, badge_id)`, so a replay is a no-op and `rebuildLearner` neither duplicates nor loses awards. Awards are never deleted by a rebuild, like certificates.
3. **Streaks and the activity graph come from a small read model.** `user_activity` (`user_id`, `day` date, `events` int, primary key on the pair) is upserted by the reducer on every learner event and cleared by `rebuildLearner` along with the other read models, so replay is exact. The current streak, longest streak, and the 53-week grid are computed on read from at most a year of rows; no counters to drift.
4. **Days are Asia/Karachi.** Pakistan has one timezone and the audience is there. The day boundary is `date_trunc('day', occurred_at AT TIME ZONE 'Asia/Karachi')`, stored as a plain `date`; the constant lives in `@repo/learning` so the graph, the streak, and any later digest agree. A learner abroad sees Karachi days, which is a deliberate simplification worth revisiting only if the audience widens.
5. **Current streak counts today or yesterday.** A streak ends when a day passes with no activity; it is still "current" if the last active day is today or yesterday, so opening the site late at night in one timezone does not silently break a streak the learner kept. `longestStreak` is computed over all history.
6. **Retroactive by design.** Adding a badge to the content repo should reward learners who already qualify, so `pnpm badges:backfill` replays every rule against existing events and awards what is missing (idempotent, same code path). It runs after `content:sync` on deploy, and the runbook line goes in `AGENTS.md` next to `certificates:backfill`.
7. **Manual awards are an admin action recorded on the row, not in the moderation queue.** `user_badges` carries `awarded_by`, `award_reason`, `revoked_at`, `revoked_reason`, `revoked_by`. A badge is an award, not content that can harm someone, so it does not belong in the moderation queue the way a revoked certificate does; the row is self-auditing and `/admin/badges` shows who did what. This deviates from the acceptance criterion's "existing audit trail" wording, which assumed the S7 pattern; the founder should confirm.
8. **`first_project_accepted` stays valid and is earned through automated checks.** Founder decision: a badge rule must never fail CI, and a project is accepted by its automated tests rather than by a person. The rule keeps its place in the schema and passes `content:check`; it is evaluated against a `project_submitted` event whose payload says the automated checks passed, exactly as an exercise is. Nothing emits that event yet (project lessons are post-MVP), so the badge simply waits rather than being rejected, and it starts awarding the day project lessons run their tests with no code change here. `content:check` warns, and does not error, when a badge can never be earned by the current release.

9. **Icons are validated against lucide.** `icon` is a lucide name (the design system already ships lucide); `content:check` verifies the name resolves, so a typo fails CI instead of rendering a blank square on a public profile. The badge component maps the name dynamically from a small allow-list built at check time.
10. **In-app notification, no email.** `badge_awarded` joins the notification kinds and stays out of `emailingKinds`: a badge is a pleasant surprise, not something worth an inbox interruption. It reaches the learner through the bell and, later, the digest.
11. **Where they show.** Dashboard: a streak line ("6-day streak, longest 11") and the activity grid, plus the badges earned. Public profile (S7): the badges grid and the streak, in the slot the profile already reserves, only when the profile is public. `/badges` lists every badge in the catalogue with earned state and, for the unearned, what the rule asks for, so they read as goals rather than mysteries.
12. **The grid is server-rendered and small.** 53 weeks by 7 days of `<div>`s with a title attribute, no charting library, no client JS. Colour is a four-step scale on the brand token so the dark theme needs no second palette.

13. **Retroactive awards are silent, and notifications are rate limited.** Founder decision. The backfill awards badges without notifying: publishing a badge must not put hundreds of rows in as many inboxes. Separately, `notify()` gains a per-user throttle so no feature can bombard a learner: at most 4 emails an hour and 12 a day per person, counted with the existing Postgres `rate_limits` table through a non-throwing `tryConsume`. When the cap is hit the in-app row is still written (it is the record, and the bell shows a count rather than interrupting) and only the email is skipped, with a line in the log. This touches `@repo/notify`, which S5 owns, so every kind benefits, not only badges.

## Alternatives considered (verified 2026-09-06)

| Option                                         | Verdict                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Compute streaks on read from `progress_events` | Scans every event of a learner for one number on every dashboard load; the day-level read model is one row per active day and replays exactly. |
| Counters on `users` (`current_streak`)         | Drifts the moment an event is backfilled or replayed; the whole point of the event stream is that derived state is rebuildable.                |
| Badge rules as code in the repo                | Mentors could not add a badge without a platform deploy; the content repo already owns badge definitions and CI validates them.                |
| A cron that awards badges nightly              | Adds a scheduler and a delay between earning and seeing; evaluating in the writing transaction is immediate and needs no new infrastructure.   |
| A charting library for the activity graph      | Kilobytes of client JS for 371 coloured squares.                                                                                               |
| UTC days                                       | A learner finishing at 2 a.m. Karachi would lose the day; the audience is one timezone, so use it.                                             |

## Schema (migration `0012_badges_streaks`)

- `badges` (content-owned): `id`, `slug` (unique), `name`, `description`, `icon`, `rule` jsonb, `content_path`, `content_hash`, `content_revision_id`, `archived_at`, timestamps.
- `user_badges`: `user_id`, `badge_id`, `awarded_at`, `awarded_by` (null = automatic), `award_reason`, `trigger_event_id`, `revoked_at`, `revoked_reason`, `revoked_by`; primary key on `(user_id, badge_id)`.
- `user_activity`: `user_id`, `day` (date), `events` int, primary key on the pair, index on `(user_id, day desc)`.
- jsonb: `badgeRuleSchema` mirrored into `json.ts` from the content schema (one source of truth for the shape, validated at the sync boundary).
- `notification_kind` gains `badge_awarded`. No new table for the throttle: `rate_limits` (S5) already holds fixed-window counters.

## API (`packages/api`)

- `badges` router: `catalogue` (public: every live badge with the caller's earned state), `mine` (protected), `byUser(handle)` folded into `profiles.byHandle` so the profile stays one query set, `award` / `revoke` (admin, reason required), `adminList`.
- `activity` in the `learning` router: `streak()` → `{ current, longest, lastActiveDay }` and `activity({ weeks })` → day buckets, both for the caller; the public profile reads the same functions for a public learner.
- `@repo/learning`: `evaluateBadges`, `awardBadge`, `recordActivity`, `streakFor`, `activityFor`, and `bin/backfill-badges.ts` (silent: awards without notifying).
- `@repo/notify`: `tryConsume(key, max, windowSeconds)` (non-throwing) and the per-user email throttle inside `notify()`; a `silent` option that writes the row and sends nothing.

## UI

| Route (LMS)     | What                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------- |
| `/` (dashboard) | Streak line, activity grid, badges earned (compact row), link to `/badges`               |
| `/badges`       | Every badge: earned with date, or the rule stated plainly ("Five lessons in seven days") |
| `/u/[handle]`   | Badges grid and streak in the slot S7 reserved                                           |
| `/admin/badges` | Award or revoke for a learner, with a reason; recent awards with who and why             |

Components: `BadgeIcon` (lucide by name), `BadgeGrid`, `StreakLine`, `ActivityGrid`, all server-rendered.

## Content repo

- `badges/*.yaml`: the two existing badges stay; add `course-finisher` (`course_completed`, the seeded course) and `first-quiz` if a matching rule kind is added, so the loop has something to earn quickly. A badge using `first_project_accepted` is valid and waits for project lessons to run their automated checks (decision 8); `content:check` warns that it cannot be earned yet and never errors.
- `CONTRIBUTING.md` gains a badge section: the rule kinds, the icon rule, and that badges award retroactively.

## Tests

1. `@repo/learning` (Postgres): the backfill awards retroactively and writes no notifications; a `lessons_in_window` badge awards exactly once on the fifth lesson within the window and not on the sixth; a lesson outside the window does not award; `course_completed` and `path_completed` award from the derived events; `rebuildLearner` leaves awards and rebuilds activity exactly (no double counting); the backfill awards only what is missing; `streakFor` across a gap, across midnight in Karachi, and with today versus yesterday as the last active day; `activityFor` buckets by Karachi day.
2. `@repo/content` and `@repo/content-schema`: badges sync (create, update, archive) with counts in the summary; `content:check` accepts `first_project_accepted` (warning only, never an error) and rejects an unknown lucide icon.
3. `@repo/notify`: the email throttle skips the email and keeps the row past the cap, the counter resets after the window, and `silent` sends nothing; `@repo/api` (Postgres): `catalogue` shows earned state and never leaks another learner's awards; `award` and `revoke` need admin and a reason and write provenance; a revoked badge disappears from the profile and the catalogue's earned state; `profiles.byHandle` includes badges and streak only for a public profile.
4. LMS (jsdom): activity grid renders 53 weeks with the right buckets and titles; badge grid shows earned versus locked.
5. Browser loop (spec rule, through the Playwright harness plus Chrome): a fresh learner completes lessons until a badge awards → bell notification → `/badges` shows it earned and the others locked with their rules → dashboard shows the streak and the grid with today filled → make the profile public and see badges and streak signed out → admin awards a badge manually with a reason and revokes another → both reflected for the learner; light and dark, desktop and 390 px, console clean, at least two fix-and-reload iterations, screenshots saved.
6. Full pipeline and the bundle budget (everything here is server-rendered; the dashboard must not gain client JS).

## Out of scope

Badge tiers or points, leaderboards (out of scope for now; the founder may revisit, so nothing here forecloses it), notifications by email for badges, streak freezes or reminders, weekly digest (X4), sharing a badge as an image, `first_project_accepted` awards (returns with projects).

## Acceptance criteria (from spec.md)

- [ ] Badge rules defined in the content repo (`badges/*.yaml`) evaluate against events; a "5 lessons in 7 days" badge awards exactly once.
- [ ] Rules are evaluated on write (the same transaction that records the event) and are idempotent under `rebuildLearner`.
- [ ] Admins can award and revoke a badge manually, with a reason, recorded on the award row and shown in `/admin/badges` (decision 7 replaces the "existing audit trail" wording; founder to confirm).
- [ ] Streak and activity graph computed from events and shown on the dashboard and the public profile.
- [ ] Retroactive awards from the backfill notify nobody, and `notify()` throttles emails per learner (4 an hour, 12 a day) without dropping the in-app row.
- [ ] Browser loop passed on the dev server for the flows in test item 5; at least two fix-and-reload iterations recorded in `test.md`.

## Open points for the founder

All four settled on 2026-09-06: manual awards record provenance on the row (decision 7); Asia/Karachi days with a today-or-yesterday streak (decisions 4 and 5); retroactive awards are silent and notifications are throttled (decisions 6 and 13); leaderboards stay out for now and may return. Decision 8 was reversed in the same message: a badge rule never fails CI, and `first_project_accepted` remains earnable once project lessons run automated checks.

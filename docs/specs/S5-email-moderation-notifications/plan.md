# S5 plan: email, moderation core, notifications

Status: `done` (see `review.md`, `test.md`). Deviations after implementation and review: `adminProcedure` dropped as unused (mentor applications are gated inside `decide`); the production guard on `EMAIL_PROVIDER=log` moved from env validation to the first send so builds need no mail credentials; role and verification are read from the users table in `mentorProcedure`, `verifiedProcedure`, and the role-gated pages because the session cookie cache cannot see an approval; `@repo/email` is loaded lazily by auth and the moderation router; the `changeEmail` procedure was not built (Better Auth's change-email flow needs its own verification round trip; S11 profile work). Founder confirmed the four open points on 2026-09-06. Spec entry: `docs/spec.md` → S5. Requirements: X1 (email provider; verification before contributing), X2 (moderation: queue, flags, policy page, audit log, role-based access), X4 (in-app notifications), F2.8 to F2.10 and F2.12 (the parts that are the shared system, not the company bank), F3.7 (mentor onboarding, as the first real subject of the queue), F4.4 and F4.5 (the shared parts), N2.1 (policy and takedown contact published); X10. Builds on S1 (Better Auth with admin and organization plugins, `users.role`, `users.emailVerified`), S3 (tRPC, app shell, account menu).

## Goal

Three shared systems that S6 to S12 all plug into, each proved end to end by one real flow: email leaves the platform (verification, password reset, organization invitations, notification mail); anything a person submits can sit in one moderation queue with an audit trail and a published policy; and a learner has one in-app inbox. The proving flow is mentor onboarding: a learner applies, the application lands in the queue, an admin approves, the role flips, the applicant gets a notification and an email. Nothing in later specs has to invent a queue, a mailer, or an inbox.

## Decisions (verified 2026-09-06)

1. **Resend for production, SMTP to Mailpit in development, a log transport in tests.** Resend: `resend` 6.26.0 (published 2026-09-03), free tier 3,000 emails/month and 100/day with 3 domains, Pro $20/month for 50,000. Postmark: free tier 100 emails/month, Basic $15/month for 10,000. Both are fine technically; Resend's free tier covers launch volume and its team maintains React Email, which we use for templates. Postmark stays one file away (decision 2). Mailpit `axllent/mailpit` 1.31.1 joins `docker-compose.yml` (SMTP 1025, UI 8025) so every email is viewable locally with no key (X9).
2. **`packages/email` (`@repo/email`) owns sending.** One function, `sendEmail({ to, subject, react })`, renders a React Email component (`@react-email/components` 1.0.12) to HTML and text and hands it to a transport chosen by `EMAIL_PROVIDER`: `resend` (API), `smtp` (`nodemailer` 10 to Mailpit or any SMTP), `log` (records to an in-memory outbox for tests and prints in `pnpm dev` when nothing else is configured). `EMAIL_FROM` is validated in `@repo/env`; production requires `EMAIL_PROVIDER=resend` and `RESEND_API_KEY`. Templates live in `packages/email/src/templates/*` with a layout in the brand (Literata heading, indigo rule, plain text body) and a `pnpm --filter @repo/email preview` script (`react-email` 6.9.3 dev server) for design work.
3. **Better Auth sends through the same package.** `emailVerification.sendVerificationEmail` and `sendOnSignUp: true`; `emailAndPassword.sendResetPassword`; `organization.sendInvitationEmail` building `/accept-invitation/<id>`; `emailVerification.autoSignInAfterVerification: true`. `requireEmailVerification` stays **off**: reading and learning never need a verified address (X1 says verification gates contributing, not learning). Contribution procedures use a `verifiedProcedure` (decision 8) instead.
4. **Moderation is three tables and one procedure family.** `moderation_items` (polymorphic: `subject_type` enum, `subject_id` uuid, `status` pending/approved/rejected/hidden/merged, `track` nullable, `submitted_by`, `assigned_to`, `decided_by`, `decided_at`, `reason`, `policy_clause`, `payload` jsonb snapshot of what was submitted), `moderation_actions` (append-only audit: `item_id`, `actor_id`, `action` submit/approve/reject/edit/merge/hide/unhide/flag/dismiss_flag/request_review, `reason`, `policy_clause`, `before` and `after` jsonb), `content_flags` (`subject_type`, `subject_id`, `reporter_id`, `reason` enum, `details`, `status` open/upheld/dismissed, `item_id`). Every status change writes an action row in the same transaction; nothing updates an item without an action. The subject types in S5 are `mentor_application` and `company_review_request` (F2.12's request-review path, modelled now so S10 only adds a subject); S6, S10, S12 add theirs by extending the enum.
5. **Access is by platform role plus track.** `mentor_tracks` (`user_id`, `track` = `course_track` enum) records which tracks a mentor may moderate; admins see everything. `mentorProcedure` requires role mentor or admin; queue queries filter by the caller's tracks unless admin. Items with no track (mentor applications, company review requests) are admin-only. Mentor as a platform role stays (data-model open question 2), with tracks as the scope.
6. **Policy page and takedown contact are content, not code.** `/policy` in the marketing site (`apps/web`) renders `docs/policy/content-policy.md` from the platform repo (numbered clauses: no naming individuals, no unverifiable accusations, no salaries claimed for others, no personal data, links from new accounts held) plus the takedown contact (`policy@devhelp.pk`, to be created by the founder). Rejections carry a `policy_clause` that links to the clause anchor. The LMS `/moderate` page links to it.
7. **Notifications are one table and one function.** `notifications` (`user_id`, `kind` enum, `subject_type`, `subject_id`, `title`, `body`, `href`, `read_at`, `emailed_at`, `created_at`, unique on `(user_id, kind, subject_type, subject_id)` where a dedupe key makes sense) and `notify()` in `packages/notify` (`@repo/notify`): inserts the row and, when the kind is marked `email: true` in a kinds table in code, sends the matching template through `@repo/email` at once. The digest (X4 "email digest") is out of scope; each kind declares whether it emails immediately, so the digest later is a scheduler change, not a schema change. Kinds in S5: `mentor_application_decided`, `moderation_decided` (generic, used by S6/S10/S12), `org_invitation` (in-app mirror of the email), `role_changed`.
8. **`verifiedProcedure` and rate limits live in `packages/api/src/trpc.ts`.** `verifiedProcedure` extends `protectedProcedure` with `user.emailVerified === true` (error `FORBIDDEN` with a message the UI turns into a "verify your email" prompt and a resend button). A small `rateLimit(key, max, windowSeconds)` helper backed by a `rate_limits` table (Postgres, no Redis: X9) is added here so F2.11 and F4.5 have it; S5 uses it for "one mentor application per 30 days" and "resend verification email once per 5 minutes".
9. **Mentor onboarding is the proving flow (F3.7).** `/mentor/apply` (signed in, verified email): track(s), GitHub handle, a short "why" and a link to work. Creates a `mentor_application` moderation item. Admin approves at `/moderate`: role becomes `mentor`, `mentor_tracks` rows are written, a `mentor_application_decided` notification and email go out, and the applicant appears on the contributors page later (S11; out of scope here). Rejection sends the reason and clause.
10. **Inbox UI is small and server-rendered where it can be.** A bell in the app shell header with the unread count (server-rendered like `AccountMenu`; no client bundle on every page), a `/notifications` page listing the latest 50 with "mark all read", and per-row mark-read on click through a server action. No polling in S5; the count refreshes on navigation. The budget stays where it is.
11. **Account pages get the minimum that email needs.** `/account` (name, city, email with verified badge and "resend verification"), `/reset-password` and `/forgot-password`, `/verify-email` landing, `/accept-invitation/[id]`. Profile as a public page is S11.
12. **CI runs with Mailpit.** The workflow adds the Mailpit service and the email tests send through SMTP to it and read back through its HTTP API (`/api/v1/messages`), so the real transport path is tested, not only the log transport.

## Alternatives considered (verified 2026-09-06)

| Option                           | Verdict                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postmark as primary              | Solid deliverability, but 100 emails/month free versus 3,000; kept as a second transport if Resend ever fails us.                                          |
| Nodemailer + own SMTP (SES) only | SES needs AWS setup and production access review; not "runs on a laptop with no paid keys" for production, and no template tooling. Used only for Mailpit. |
| Novu / Knock for notifications   | Hosted, another account and key; our needs are one table and one function. Revisit only if push or SMS arrive.                                             |
| Redis-backed rate limiting       | Adds a service; Postgres counters are enough at launch volume and CI already has Postgres.                                                                 |
| Per-subject moderation tables    | Would multiply UI and audit code per subject type; the polymorphic item plus a jsonb snapshot keeps one queue for every area (X2).                         |

## Schema (migration `0006_moderation_notifications`)

- Enums: `moderation_subject` (mentor_application, company_review_request), `moderation_status`, `moderation_action`, `flag_reason` (names_individual, unverifiable, personal_data, spam, off_topic, other), `flag_status`, `notification_kind`.
- Tables: `moderation_items`, `moderation_actions`, `content_flags`, `mentor_tracks`, `notifications`, `rate_limits` (`key`, `count`, `window_started_at`).
- jsonb: `moderation_items.payload`, `moderation_actions.before/after` get Zod schemas in `json.ts` (per subject type, discriminated union).
- No Better Auth schema change expected; if `sendInvitationEmail` needs an extra field, regenerate with the `auth` CLI as documented.

## API (`packages/api`)

- `account` router: `me`, `updateProfile`, `resendVerification` (rate limited), `changeEmail` (deferred if Better Auth's flow needs more than S5; note it).
- `moderation` router: `queue({ status, subjectType, track, cursor })` (mentor/admin, track-scoped), `item(id)`, `decide({ id, action: approve|reject, reason, policyClause })`, `flag({ subjectType, subjectId, reason, details })` (verified users), `flags(...)`, `requestReview(...)` (company review request, F2.12; admin-only subject until S10 wires companies).
- `mentor` router: `apply(...)` (verified, rate limited), `myApplication`.
- `notifications` router: `list({ cursor })`, `unreadCount`, `markRead(id)`, `markAllRead`.
- Procedures: `verifiedProcedure`, `mentorProcedure`, `adminProcedure`.

## UI

| Route (LMS)                           | What                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/account`                            | Profile fields, email verified state, resend verification, password reset link                |
| `/verify-email`                       | Landing after the link; success or expired with resend                                        |
| `/forgot-password`, `/reset-password` | Better Auth flows with the design system forms                                                |
| `/accept-invitation/[id]`             | Organization invitation acceptance (sign in or sign up first)                                 |
| `/mentor/apply`                       | Application form; shows status once submitted                                                 |
| `/moderate`                           | Queue (tabs by status, filter by subject and track), item detail with decide form and history |
| `/notifications`                      | Inbox list, mark read                                                                         |
| Header bell                           | Unread count, links to `/notifications`                                                       |

| Route (web) | What                                                          |
| ----------- | ------------------------------------------------------------- |
| `/policy`   | Content policy with numbered clauses and the takedown contact |

Emails (React Email): verification, password reset, organization invitation, mentor application decided, generic moderation decided.

## Files

- New: `packages/email/**`, `packages/notify/**`, `packages/api/src/routers/{account,moderation,mentor,notifications}.ts`, `packages/database/src/schema/moderation.ts`, `notifications.ts`, `drizzle/0006_*`, `apps/lms/app/{account,verify-email,forgot-password,reset-password,accept-invitation/[id],mentor/apply,moderate,notifications}/**`, `apps/lms/components/{moderation,notifications,account}/**`, `apps/web/app/policy/page.tsx`, `docs/policy/content-policy.md`, `.github/workflows/ci.yml` (Mailpit service), `docker-compose.yml` (Mailpit).
- Changed: `packages/auth/src/server.ts` (email hooks), `packages/env` (`EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `SMTP_URL`), `turbo.json` `globalEnv`, `.env.example`, `packages/api/src/trpc.ts` (procedures, rate limit), `apps/lms/components/shell/*` (bell, account link), `AGENTS.md`, `docs/data-model.md`, `docs/requirements.md` (X1/X2/X4 "as built" notes).

## Tests

1. `@repo/email`: the log transport captures subject, recipient, HTML and text; templates render without React warnings; the SMTP transport delivers to Mailpit and the message is readable through Mailpit's API (skipped when `SMTP_URL` is unset locally, always on in CI).
2. `@repo/auth` (Postgres + Mailpit): sign-up sends a verification email whose link verifies the user; password reset round trip; organization invitation email carries the accept link.
3. `@repo/api` (Postgres): `verifiedProcedure` rejects unverified users with `FORBIDDEN`; `moderation.decide` writes item and action in one transaction and rejects a second decision; track scoping (a technical-track mentor cannot see a career-track item; admin sees both); `mentor.apply` rate limit; approving an application flips the role, writes `mentor_tracks`, inserts the notification, and sends the email (log transport); `notifications.markAllRead` only touches the caller's rows.
4. `@repo/notify`: `notify()` dedupes on the key and emails only kinds that declare it.
5. LMS (jsdom): moderation decide form validation (reason required on reject, clause picker), notification row mark-read, apply form.
6. Browser loop on the dev server (spec rule): sign up → verification email in Mailpit → verify → `/account` shows verified; forgot/reset password; `/mentor/apply` as a verified learner (and the blocked state as unverified); `/moderate` as admin (approve one, reject one with a clause), the applicant's bell count and inbox; `/accept-invitation/[id]` from an organization invitation; `/policy` on the web app; light and dark; desktop and narrow; console clean; at least two fix-and-reload iterations recorded; screenshots saved.
7. Full pipeline and the bundle budget (the bell must not add client JS to lesson pages).

## Out of scope

Email digest scheduling (X4 P1), comments and their flags (S12), company bank subjects beyond the review-request stub (S10), public profiles and the contributors page (S11), mentor dashboard (F3.8, S11), Keystatic studio (S11), analytics (X6), search (X3).

## Acceptance criteria (from spec.md)

- [x] Verification and invitation emails send in dev via a local catcher (Mailpit in docker-compose) and in prod via Resend (Postmark kept as a one-file alternative).
- [x] `moderation_items` supports any subject type; approve/reject/edit/merge actions are logged with actor and reason.
- [x] Mentors see only their track's content items; admins see all.
- [x] Notifications table with read state; in-app list in the app shell header.
- [x] Browser loop passed on the dev server for the flows in test item 6; at least two fix-and-reload iterations recorded in `test.md`.

## Open points for the founder

1. Resend as the production provider (decision 1). Confirm, and create the Resend account and the `devhelp.pk` sending domain when you are ready; the platform runs on Mailpit until then.
2. `policy@devhelp.pk` as the takedown contact on the policy page (decision 6). Confirm the address, or give another.
3. Mentor scope by track (decision 5): a mentor moderates only their tracks (`technical`, `career`) and admins moderate everything, including mentor applications. Confirm, or say if mentors should also approve mentor applications in their track.
4. Email verification never blocks learning, only contributing (decision 3). Confirm.

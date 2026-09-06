# S7 plan: certificates and public profiles

Status: `done` (see `review.md`, `test.md`). Deviations after implementation and review: the criteria snapshot carries the content repo and commit itself (the sync prunes `content_revisions`, so the foreign key can vanish and is now a convenience); `users.handle` uniqueness is a case-insensitive index in migration `0011` because `schema/auth.ts` is generated; the moderation queue records a certificate revocation but cannot reverse it (admin routes own that); the verify page is invalidated by a server action on revoke and restore. Founder decisions 2026-09-06: founder decisions 2026-09-06: R2 from day one and no raw files in Postgres ever (decision 4 rewritten); one completion certificate per course (decision 1 rewritten); profiles at `/u/<handle>` and admin-only revocation confirmed. Spec entry: `docs/spec.md` → S7. Requirements: F1.18, F1.19, F1.19a, F1.20, X5; X10. Builds on S1 (`course_completed` events, `content_revisions`), S3 (course page, dashboard), S5 (notifications, admin role, account page), S6 (course reviews on the profile later).

## Goal

Finishing a course produces something a learner can put on LinkedIn and an employer can trust: a verify page that shows what was actually done, a PDF of the same record, and a public profile that collects them. Issuance is part of completion itself, so it can never be missed, and every certificate points at the exact content revision it was earned on.

## Decisions (verified 2026-09-06)

1. **Issue inside the completion transaction.** The reducer's `course_completed` case (`@repo/learning`) inserts the `certificates` row in the same transaction that marks the enrolment completed: `id` (the verify uuid), `userId`, `courseId`, `enrolmentGeneration`, `learnerName` (the name at issue time), `courseTitle`, `contentRevisionId` (the course's revision at issue), `criteria` snapshot jsonb (criteria object, required lessons with titles and completion dates, best quiz scores, accepted projects placeholder), `issuedAt`, `revokedAt`, `revokedReason`, `revokedBy`. Unique on `(userId, courseId)`: one completion certificate per course (founder decision). Replaying the stream (`rebuildLearner`) is idempotent, and completing the course again after drop + re-enrol keeps the original certificate (`enrolmentGeneration` records which enrolment earned it). Replay never re-issues and never deletes.
2. **The verify page lives on the LMS.** `learn.devhelp.pk/verify/[uuid]` is public, server-rendered, indexable (`robots: index`), cached with `revalidate` because it reads no session: learner name, course, issue date, the content revision (commit short sha with a link to the content repo at that commit), the snapshot as a checklist (lessons, quiz scores, projects), and a "Revoked on <date>: <reason>" banner when revoked. Unknown uuid → 404. The marketing site links to it; it does not need database access.
3. **PDF with `@react-pdf/renderer` 4.9, generated on first request and cached.** Pure JS, no headless browser, React components for layout (A4 landscape, brand mark, Literata heading, learner name, course, date, criteria summary, the verify URL and a QR code from `qrcode` 1.5 rendered as an embedded PNG). Fonts: Literata and Geist TTFs vendored into `packages/certificates/fonts` (both are OFL; no network at generation time). Route: `/api/certificates/[uuid].pdf` streams the cached file with `Content-Disposition: attachment`; anyone with the uuid can download (the verify URL is already public).
4. **Object storage from day one: Cloudflare R2 in production, MinIO locally and in CI, never Postgres.** `packages/storage` (`@repo/storage`): `put(key, bytes, contentType)`, `get(key)`, `delete(key)`, `exists(key)`. One driver for every environment, `s3` through `@aws-sdk/client-s3` 3.11xx (R2 speaks the S3 API), configured by `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`. `docker-compose.yml` gains MinIO (`minio/minio`, console on :9001) with a bucket created on start, and CI runs the same image, so a laptop and the pipeline exercise the real S3 path with no paid keys (X9). A `fs` driver (files under `.storage/`, gitignored) exists for unit tests only; app code never sees Postgres bytes. Founder decision: no raw files in Postgres, ever.

5. **Revocation is an admin action with a reason, logged and notified.** `certificates.revoke({ id, reason })` (admin) sets `revokedAt/reason/by`, writes a `moderation_actions`-style audit row (the certificate gets a `moderation_items` row with subject `certificate` so the existing audit trail and `/moderate` history apply), invalidates the cached PDF (the regenerated PDF carries a REVOKED stamp), and notifies the learner (`certificate_revoked`, emailed). Un-revoke is a second admin action (`unhide`) for mistakes. Admin UI: `/admin/certificates` lists recent certificates with search by learner or course and the revoke form; the account menu shows "Admin" for admins.
6. **Public profiles are opt-in with a handle.** Better Auth `user.additionalFields` gain `handle` (unique, 3–30 chars, lowercase letters, digits, hyphen), `profilePublic` (boolean, default false), `bio` (≤ 280), `links` jsonb (github, website, linkedin). `/u/[handle]` is public, indexable when `profilePublic`, otherwise 404: name, city, member since, bio and links, certificates (issued, not revoked) with verify links, and slots that S8 fills (badges, accepted projects) and S10 (contributions count). The account page gains a Profile section: handle, public toggle, bio, links, and a preview link. Handles are reserved words checked (`admin`, `verify`, `courses`, …).
7. **Certificates on the learner's own pages.** The dashboard's completed courses show "View certificate" and "Download PDF"; the course page shows the certificate card when completed; `/certificates` lists all of a learner's certificates. Each has "Add to LinkedIn" (the prefilled `addToProfile` URL with name, issue date, and the verify URL as the credential URL) and a copy button for the verify link.
8. **Backfill for learners who completed before S7.** `pnpm certificates:backfill` (bin in `@repo/learning`) issues missing certificates for every completed enrolment by replaying the same issuance function with `issuedAt = completedAt`; idempotent; run once on deploy and documented in the runbook section of `AGENTS.md`.
9. **Single tier now.** A certificate says "completed" and shows exactly what was done; when S8 lands, accepted projects appear in the snapshot and a "verified with project" mark is derived from it. The tracker's open question on two tiers is answered by the snapshot rather than by a second certificate type; the founder can still choose to require a project in a course's `completionCriteria` (`requireProjectAccepted`), which the reducer already honours.
10. **Names change; certificates do not.** `learnerName` is a snapshot. The account page tells the learner that a name change does not alter issued certificates, and the profile shows the current name next to the certificate's name only if they differ.

## Alternatives considered (verified 2026-09-06)

| Option                                         | Verdict                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright / Chromium to print the verify page | Faithful, but a browser in production and in CI for one page; `@react-pdf` gives the same brand in pure JS.                             |
| `pdfkit` 0.20 directly                         | Fine and lighter, but imperative layout; React components keep the certificate close to the design system.                              |
| `pdf-lib` 1.17                                 | Last release 2022; for filling forms, not layout.                                                                                       |
| Generate at issue time and store               | Would put PDF rendering inside the completion transaction; on-demand + cache keeps completion fast and lets a design change regenerate. |
| R2 / S3 only                                   | A paid-account dependency on a laptop and in CI; the Postgres driver keeps X9 and the interface makes R2 a config change.               |
| Public profile at `/[handle]`                  | Collides with routes; `/u/[handle]` is unambiguous.                                                                                     |

## Schema (migration `0009_certificates_profiles`)

- `certificates` (decision 1) with indexes on `userId`, `courseId`, `issuedAt`; `users` gains `handle` (unique index, nullable), `profile_public`, `bio`, `links` jsonb (via the Better Auth generator, then drizzle); `moderation_subject` gains `certificate`; `notification_kind` gains `certificate_issued`, `certificate_revoked`.
- jsonb: `certificateCriteriaSchema` and `profileLinksSchema` in `json.ts`; the moderation payload union gains `certificate` (learner, course, issue date).

## API (`packages/api`)

- `certificates` router: `mine` (protected), `byId(uuid)` (public; the verify page's data), `revoke` / `restore` (admin), `adminList({ q, cursor })` (admin).
- `profiles` router: `byHandle(handle)` (public), `updateProfile` extended in `account` (handle, public, bio, links) with handle validation and reserved-word check.
- Route handler: `apps/lms/app/api/certificates/[uuid].pdf/route.ts` (render on miss, `@repo/storage` cache, stream).
- `@repo/learning`: `issueCertificate(tx, …)` used by the reducer and the backfill; `certificateSnapshot(tx, userId, courseId)` builds the criteria snapshot from `lesson_progress`, `quiz_attempts`, and (later) `project_submissions`.

## UI

| Route (LMS)            | What                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `/verify/[uuid]`       | Public verify page (decision 2), `Metadata` with title and description for link previews |
| `/certificates`        | The learner's certificates: card per course, verify link, PDF, Add to LinkedIn           |
| `/u/[handle]`          | Public profile (decision 6)                                                              |
| `/account` (extended)  | Profile section: handle, public toggle, bio, links; note on certificate names            |
| `/admin/certificates`  | Admin list, search, revoke / restore with reason                                         |
| Dashboard, course page | Certificate card on completed courses                                                    |

Emails: `CertificateIssued` (with the verify link and PDF link), `CertificateRevoked` (reason, policy contact).

## Files

- New: `packages/certificates/**` (PDF component, fonts, QR), `packages/storage/**`, `packages/learning/src/certificates.ts`, `packages/learning/bin/backfill-certificates.ts`, `packages/database/src/schema/certificates.ts`, `drizzle/0009_*`, routers `certificates.ts` and `profiles.ts`, `apps/lms/app/{verify/[uuid],certificates,u/[handle],admin/certificates,api/certificates/[uuid].pdf}/**`, `apps/lms/components/{certificates,profile}/**`, templates in `@repo/email`.
- Changed: `packages/learning/src/reducer.ts` (issue on completion), `packages/auth/src/server.ts` (additional fields; regenerate `schema/auth.ts`), `packages/api/src/routers/account.ts`, `apps/lms/app/page.tsx` and `courses/[course]/page.tsx` (certificate card), `account-menu.tsx` (Admin link), `@repo/env` (`STORAGE_DRIVER`, `S3_*`), `turbo.json`, `.env.example`, `AGENTS.md`, `docs/data-model.md`, `docs/requirements.md`.

## Tests

1. `@repo/learning` (Postgres): completing a course issues exactly one certificate with the snapshot (required lessons, best quiz score, revision id, learner name); `rebuildLearner` does not duplicate or delete it; drop + re-enrol + complete issues a second with generation 2; backfill issues only the missing ones.
2. `@repo/storage`: put/get/exists/delete round trip on the `fs` driver, and on the `s3` driver against MinIO (docker-compose locally, a service in CI).
3. `@repo/certificates`: the PDF renders to a buffer with the learner name, verify URL text, and a QR image; a revoked certificate renders the stamp.
4. `@repo/api`: `byId` for unknown uuid → `NOT_FOUND`; revoke needs admin and a reason, logs, notifies, and the verify data shows revoked; restore; handle validation (reserved, format, uniqueness, case-insensitive); private profile → `NOT_FOUND`, public → data; `mine` returns only the caller's.
5. LMS (jsdom): certificate card links, profile form validation messages.
6. Browser loop (spec rule, through the Playwright harness plus Chrome): complete the seeded course as a fresh learner (quiz pass completes it) → notification and email → `/certificates` → verify page (signed out, in another context) → PDF downloads and opens (size > 20 KB, `%PDF` header) → Add to LinkedIn link shape; set a handle, make the profile public, view `/u/<handle>` signed out; admin revokes with a reason → verify page shows revoked, PDF regenerated with the stamp, learner notified; restore; light and dark, desktop and 390 px, console clean, at least two fix-and-reload iterations recorded, screenshots saved.
7. Full pipeline and the bundle budget (the verify and profile pages are server-rendered; no new client bundles on lesson pages).

## Out of scope

Badges and accepted projects on the profile (S8), contributions count (S10), certificate templates per course or org co-branding (S9 may want cohort certificates), Open Badges / verifiable-credential export, employer accounts.

## Acceptance criteria (from spec.md)

- [x] Certificate issues in the same transaction as course completion, with a criteria snapshot and `content_revision` reference.
- [x] `/verify/[uuid]` is public, indexable, shows the snapshot, and says "revoked" with reason when revoked.
- [x] PDF is generated server-side, cached in object storage (R2 in production, MinIO locally and in CI), re-downloadable.
- [x] Public profile shows name, city, certificates; private by default.
- [x] Browser loop passed on the dev server for the flows in test item 6; at least two fix-and-reload iterations recorded in `test.md`.

## Open points for the founder

1. Storage: Postgres by default with an S3/R2 driver behind config (decision 4). Confirm, or say if you want the R2 bucket created now so production starts on it.
2. One certificate tier (decision 9): the certificate says "completed" and lists exactly what was done; a course can still require an accepted project through its completion criteria. Confirm, or ask for the two-tier model from the open questions.
3. Public profiles at `/u/<handle>` with an opt-in toggle, private by default (decision 6). Confirm the URL shape and that handles are learner-chosen.
4. Revocation: admins only, always with a reason, learner notified and emailed (decision 5). Confirm.

# Platform review against the full spec — 2026-09-12

A read across `requirements.md` (78 requirements), `spec.md` (S0–S17), the code, the
running dev server, and the dev database. The question asked was "what have we built,
and what is left", so everything below is either checked against code and data or
marked as not checked.

## Where the spec stands

| Specs                                                              | Status                |
| ------------------------------------------------------------------ | --------------------- |
| S0–S8, S10a, S10b, S10c, S11, S13, S14, S15                        | `done` / `complete`   |
| S16 (shell and controls), S17 (density), S18 (admin/studio review) | open, detail below    |
| S9 (cohorts)                                                       | `deferred` by founder |
| S12                                                                | merged into S6        |

Requirement coverage by area, checked against code rather than the tracker:

- **Area 1, learning (F1.1–F1.22, N1.1–N1.3).** Built except F1.14 (offline
  tolerance), F1.15 (project submissions and review), and F1.21/F1.22 (cohorts) —
  all three deliberately deferred and in the backlog.
- **Area 2, company bank (F2.1–F2.15, N2.1–N2.3).** Built. Two gaps: **F2.9's "merge
  duplicate companies"** is unbuilt — `moderation_items.status` has a `merged` value
  and no action can reach it, so a duplicate has to be handled by hand in the
  database; and **F2.15**, company-to-course cross-links, deferred in S13.
- **Area 3, content and mentors (F3.1–F3.10, N3.1–N3.3).** Built, with two recorded
  reshapes: F3.3 became the in-app studio instead of Keystatic (S11), and F3.8's
  GitHub-issues panel was cut — the revision signals that did ship live on `/studio`
  (`studio.overview`: rating below 3.5 with n ≥ 3, unclear count ≥ 3, open questions
  ≥ 1). There is no `/mentor` dashboard route; `/mentor/apply` is the only thing
  under that path, which is correct but means the word "dashboard" in F3.8 now means
  the studio.
- **Area 4, feedback and discussion (F4.1–F4.7, N4.1–N4.3).** Built.
- **Cross-cutting (X1–X10).** Built except **X6, analytics** (deferred post-MVP in
  S14) and **X4's email digest** (deferred; the more likely route back to
  notification email now that `emailingKinds` is empty). X8's "static-rendered with
  ISR" is knowingly not what we do: company and catalogue pages are
  `force-dynamic`, because a cached read kept a hidden review public for seconds
  after the moderator's decision. That trade is recorded in `AGENTS.md`, but the
  requirement's wording was never updated to match.

## Measured today

- `format`, `lint`, `check-types`, `test` (41 test files), `build`: all pass.
- First-load JS against a production server, gzipped, ceiling 300 KB:

  ```
  /courses/…/welcome            230.0 KB
  /courses/…/foundations-check  230.0 KB
  /courses/…/trace-the-refund   230.0 KB
  /courses                      231.7 KB
  /companies                    248.4 KB
  /companies/arbisoft           255.3 KB   over the 250 target, under the ceiling
  /                             231.7 KB
  ```

  Note the budget only measures **signed-out** renders, so the S16 sidebar shell —
  which only signed-in users load — is not in any of these numbers. Nothing is over
  the ceiling; nothing is measured for the shell.

- Dark-mode select check, which S16 listed as outstanding: the badge picker's
  listbox on `/admin/badges` opens as an admin with readable text on a themed
  popup. That item is closed.

## What is actually left

### Open spec work

1. **S16.** D3 still deferred: `AppShell` and the lesson reader's own sidebar
   coexist with shadcn's `Sidebar`, so the package carries two sidebar systems
   until the reader is ported. The shell has had no dedicated 390px pass (the
   company pages and the About panel have).
2. **S17.** `/account`, `/badges`, the shell measure, `/studio`, `/moderate`, the
   admin pages and `/` (the dashboard — checked today: already wide, two-up cards,
   no dead width) are done. Nothing identified as left.
3. **S18 has no entry in `spec.md`** even though its review drove three commits.
   Its "still open" list is also stale: `/studio/paths/[slug]`,
   `/studio/lessons/[id]`, `/admin/certificates` pagination and the mobile audit
   all landed in `6d2c204`.
4. **S15's browser loop across the seven viewer states** was done for the
   signed-out state only, and from a static snapshot of the real response rather
   than a live signed-out session, because signing out would have taken the
   founder's own session with it. The unverified-viewer and
   verified-non-contributor walls have never been seen in a live browser.
5. **The moderation queue has no bulk action.** Noted in S18 and still true; 800
   seeded salary points is not a realistic volume, so this is a "decide if it
   matters" item rather than a defect.

### Found in this review

6. **The dev database has 21 published courses, 19 of which are test leftovers**
   (`course-mtxu1grn-tuse4`, `sync-mtxu17e2-fresh`, …) and two of those slugs
   appear in the rendered `/courses` HTML. Integration tests create published
   courses and do not clean them up. Harmless locally; on any long-lived database
   it publishes junk into a catalogue. Worth a cleanup helper in the test teardown,
   or a seed-reset step.
7. **No content metadata is filled in.** Both real courses have
   `estimated_hours` NULL, all 61 lessons have `duration_minutes` NULL or 0, and
   `content_credits` is empty — so the catalogue shows "0 min", every lesson byline
   is empty, and `/contributors` has nothing to list. The platform is working as
   designed (this is studio-owned metadata, S11); the data has simply never been
   entered. This is a pre-launch founder task, not a code change.

### Founder actions already recorded and still open

8. Production env: `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`, the R2 bucket and
   `S3_*`, a `policy@devhelp.pk` mailbox, `PLATFORM_PR_TOKEN` on the content repo,
   and a daily `pnpm fx:refresh`.
9. The placeholder video id in `02-how-agents-work.mdx`.
10. `certificates:backfill` on first deploy.

### Deliberately deferred, recorded, not forgotten

Cohorts (S9), project submissions and review, offline tolerance, badge backfill,
peer review, analytics (X6), email digests (X4), company-bank verification
mechanics, F2.15 cross-links, and server-side exercise verification.

## The one thing I would fix before launch

Nothing in the list above blocks a launch except (7): a catalogue that says every
course takes 0 minutes and was written by nobody reads as broken, and it is the
first screen a visitor sees. It is half an hour in the studio, not an engineering
task.

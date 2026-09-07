# S13. Company claims and public responses

Scope: F2.12 (the public half — companies can respond to what is written about them) and the claim flow that makes it possible. **F2.15, the links between company pages and courses, is deferred** (founder, 2026-09-07).

S10a made this cheap on purpose: a company is a Better Auth organisation, so "this person represents this company" is ordinary membership rather than a second identity model. This spec is mostly the flow that gets them there, and the one new piece of public writing.

## Decisions

Two settled with the founder on 2026-09-07.

1. **A claim needs a work email and an admin.** The claimant must hold a verified devhelp account whose email domain matches the company's own website, and an admin approves on that evidence. The domain check is the same one `affiliationFor` already does for the "verified employee" mark in S10a, so this is reusing a rule rather than inventing one. A company with no website on file, or a claimant on Gmail, is not refused outright — the request reaches an admin with the evidence marked absent, and they decide.

2. **A response is queued like every other contribution.** A public reply is prose about a named person's experience, written by the party with the most incentive to push back, aimed at someone anonymous who cannot answer back symmetrically. It goes through the same admin queue and the same policy clauses as a review.

## Schema

Migration `0019_company_claims`.

- `company_claims`: `id`, `organization_id`, `user_id`, `status` (`pending`, `approved`, `rejected`), `evidence` jsonb (the domain compared, whether it matched, what the claimant wrote), `decided_by`, `decided_at`, timestamps. Unique on (organisation, user) so one person has one open claim per company.

  The claim is its own row rather than a bare moderation item because `moderation_items` is unique on (subject type, subject id) — two people claiming the same company would collide, which is the trap S10c already hit with salary reports.

- `company_responses`: `id`, `organization_id`, `subject_type` (`company_review`, `interview_experience`), `subject_id`, `author_id`, `body`, `body_html`, `status` (`contribution_status`), timestamps. Unique on (subject type, subject id): one response per post, editable, not a thread.

- `moderation_subject` gains `company_claim` and `company_response`, each with a payload schema.

## API

- `claims.request`: verified procedure, rate limited, computes the domain evidence, opens the claim and its queue item.
- `claims.mine` / `claims.forCompany`: what a claimant and an admin see.
- Approving a claim adds the user to `members` as `owner` in the deciding transaction, so from then on membership is the source of truth and the claim row is history.
- `responses.submit`: restricted to a member of that organisation, Markdown rendered and sanitised on the server at write time exactly as S6 does, queued.
- `companies.bySlug` gains the published responses, so the company page renders them under the post they answer.

## Pages

- A "Do you work here?" path on the company page leading to a claim form that states plainly what evidence is checked.
- `/companies/[slug]/manage` for members: the reviews and interviews about them, with a reply box on each, and the state of anything queued.
- Responses render under the review or interview they answer, marked as coming from the company, never anonymous.
- The moderation queue renders both new subjects.

## Tests

1. `@repo/api` (Postgres): a matching work-email domain is recorded as evidence and a non-matching one is not; approving a claim makes the claimant an organisation member; a rejected claim leaves membership untouched and can be re-requested; only a member may respond; a response is invisible until approved and appears under its post afterwards; one response per post, and an edit returns it to the queue without republishing something an admin hid; a non-member and a signed-out visitor are refused.
2. Browser loop: the claim form, the manage page, a response appearing under a review, and the queue view, in both themes at both widths.

## Out of scope

Company↔course cross-links (F2.15, deferred), analytics on company pages, multiple responses per post, and any company-side editing of the facts — those stay admin-owned as S10a decided.

## Acceptance criteria

- [ ] A claim records what evidence was checked, and approving one makes the claimant an organisation member.
- [ ] Only a member of that company can write a response, and a response is invisible until an admin approves it.
- [ ] A response renders under the post it answers, attributed to the company rather than a person.
- [ ] An edited response returns to the queue and cannot republish something an admin hid.
- [ ] Browser loop passed, at least two fix-and-reload iterations recorded in `test.md`.

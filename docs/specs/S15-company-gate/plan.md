# S15. Company page: information hierarchy, and a give-to-get gate

Status: **awaiting founder approval.** Two halves, deliberately in one spec: the gate changes what a page shows to most visitors, so re-ranking the page without knowing which parts survive the gate would be work done twice.

Requirement ids refer to `docs/requirements.md`.

---

## Founder decisions needed before this is `planned`

These change the shape of the work, not just its details. The rest of the plan assumes the recommendation in each case.

### D1. This contradicts F2.14. Which way does it go?

F2.14 reads: _"Company pages are public and indexable; they are the main SEO entry point for the platform."_ S10a built to it, S14's search reads company rows, and the S14 launch pass treated company pages as the acquisition route. A gate that hides the page from signed-out visitors deletes that route, and it deletes it for search engines too — Googlebot has no verified email and will never contribute.

Three options:

|                               | What a signed-out visitor and Googlebot get                                                                                                                                                         | SEO                                                                                     | Answers the ask                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **a. Gate everything**        | Name only, behind a wall                                                                                                                                                                            | Gone. Company pages leave the index.                                                    | Fully                                              |
| **b. Two-tier (recommended)** | The **facts tier**: name, logo, industry, size, cities, founded, website, hires-juniors, stack, review count, interview count, overall rating. No review text, no pay figures, no interview detail. | Kept. Thin but real pages stay indexable, and the wall itself is the conversion prompt. | Substantially — every contributed opinion is gated |
| **c. Gate only pay**          | Everything but salaries                                                                                                                                                                             | Kept in full                                                                            | Partially                                          |

**Recommended: (b).** It is what Glassdoor actually does, it keeps F2.14 true in substance ("public and indexable") while making the contributed content give-to-get, and it gives the wall something to sit on — a page with a company's real facts and "11 reviews, 4 interviews, pay for 2 roles" is a far better conversion prompt than a bare wall. Choosing (a) means amending F2.14 and accepting that the company bank stops being an acquisition channel; that is a legitimate choice, but it should be made knowingly.

**Whatever is chosen, F2.14 must be rewritten in `requirements.md` as part of this spec.** A requirement that the code deliberately contradicts is worse than either answer.

### D2. Cold start: who can possibly be eligible on day one?

The rule as stated is circular at launch. Nobody can read a company page without having contributed; nobody contributes to a bank they cannot read; the platform has no users. Taken literally, on launch day the company bank is invisible to every single visitor, including the people most likely to contribute.

Options:

- **d2a (recommended). Verified email alone, until the bank is warm.** A single env-free constant — `CONTRIBUTION_GATE_ACTIVE_FROM_CONTRIBUTIONS = 250` — checked against the count of published contributions. Below it, verified email is the whole gate. Above it, the contribution rule switches on by itself. One number, visible in code, no migration to flip, and no month where the product is unusable.
- **d2b. A free allowance.** Every verified account reads N (say 3) company pages, tracked per user, then must contribute. More generous, but it needs a table, a counter on a read path, and a decision about what a "read" is.
- **d2c. Literal rule from day one.** Simplest to build, and the company bank is dark until the founder seeds contributions by hand.

### D3. Does a pending contribution count?

**Recommended: yes, but a rejected or hidden one does not.** Counting only approved contributions means a learner who contributes on Friday is locked out until a moderator gets to it, which punishes them for our latency. Counting rejected ones would make "submit anything" a valid key. So eligibility counts `pending` and `published`, and excludes `rejected` and `hidden`.

The consequence to accept: someone can submit one plausible-looking review, read the bank for as long as moderation takes, and be cut off when it is rejected. That is bounded and reversible, and it is the right side to err on.

### D4. Who is exempt?

**Recommended:** admins and mentors (moderation is impossible through a wall); a member of the company's own organisation, for that company's page only (S13 gave representatives a reason to be there, and a claimed company that cannot read its own reviews cannot reply to them); and the author of a contribution, for the company they contributed to — which D3's rule already grants.

---

## Part A — information hierarchy and the page itself

### What is wrong now

Read from the rendered page (`/companies/arbisoft`, the seeded fixture), not only the source.

1. **The orientation facts are last in the DOM, and for more viewers than "mobile".** `Facts` — industry, size, founded, cities, hires juniors, website — is an `<aside>` after reviews, pay and interviews. The grid is `lg:grid-cols-[minmax(0,1fr)_18rem]`, so it is a right-hand column **only from 1024px up**. Below that — every phone, every tablet, and any laptop window under 1024px — it stacks at the very bottom, and the reader scrolls past three long sections of opinion before learning what the company does or where it is. The order should be: who they are → what the numbers say → the opinions behind them.
2. **The header duplicates the facts panel.** `Software consultancy · Lahore, Islamabad` under the H1 repeats two of the six rows in `Facts`, so the page says the same thing twice and neither placement feels authoritative.
3. **The single most decision-relevant number is buried.** _"50% would recommend working here"_ sits below five sub-score bars. Recommend-rate is the number a job seeker acts on; sub-scores are the explanation. The order is inverted.
4. **Precision is claimed that the data cannot support.** With `reviewCount = 2`, the page prints an overall `3.5` and five sub-scores to one decimal. One more review moves `Management` by a whole point. Below a threshold (suggest n < 5, matching the salary floor's logic) sub-scores should be withheld or shown as a coarse band, and the count should be adjacent to every average, not only the first.
5. **The heading outline is not a hierarchy.** `<h3>` is used for role names in Pay, for `Pros` / `Cons` / `Advice` inside a review card, and for `Questions asked` inside an interview card — three different semantic levels sharing a level. A screen-reader user navigating by heading gets a flat, misleading list. Card field labels should not be headings at all.
6. **No way to get anywhere.** The page is long, has four major sections, and offers no jump links or counts-at-a-glance. A visitor who came for pay scrolls through every review to find it.
7. **`Sign in to report` is repeated under every item** at the same visual weight as real content — three instances in the fixture, and it scales with the content. It is a rarely-used control given permanent prominence.
8. **The trust disclosure is in the last place anyone looks.** _"Facts are checked by the devhelp team… Nothing here identifies its author."_ is the sentence that makes an anonymous review bank credible, and it is the final line of a sidebar. For a brand-new platform asking people to trust it with employer opinions, that is backwards.

Unverified, for the browser loop to settle: the Pay table (`hidden sm:block`, `w-full`, four columns, no `overflow-x-auto` wrapper) appears from 640px, where the layout is still single-column. Strings like `PKR 220,000 to PKR 370,000` beside a role name and a nested breakdown may or may not force a horizontal scroll in the 640–1024px band. It is cheap to wrap defensively; it needs a real viewport to confirm, and it is exactly the band the existing "mobile checks ran at 500px" follow-up never covered.

Not a defect, checked and dismissed: `Pay` renders a card list (`sm:hidden`) and a table (`hidden sm:block`). Both are in the DOM, but `display: none` hides one from assistive tech too, so it is a payload trade-off, not a duplication bug. Leave it.

### What this spec changes

- Reorder to: **identity header → at-a-glance strip → facts → pay → interviews → reviews → disclosure**, with `Facts` moved out of the trailing `<aside>` into a position that survives the mobile collapse. Pay and interviews above reviews because they are the actionable, decision-shaped content; reviews are the longest and least skimmable.
- An **at-a-glance strip** under the header: rating with n, recommend-rate, review count, interview count, "pay reported for N roles". For a gated visitor this strip is the teaser and stays visible (tier decision D1).
- **Withhold sub-scores below n = 5**, print the n beside every average, and round the overall to the precision the sample supports.
- **Fix the heading outline**: `<h2>` per section, `<h3>` only for a named sub-thing that is genuinely a section (a role in Pay), card field labels become non-heading text with the same visual treatment.
- **Jump links** in the at-a-glance strip to each section.
- **Demote the report control** to a quiet affordance on the card, and **promote the disclosure** to sit directly under the at-a-glance strip.
- Re-check against `packages/ui/DESIGN.md`; no new tokens, no restyling, no new components in `@repo/ui` (scope rule in `AGENTS.md`).

Explicitly **not** in scope: a redesign of the directory (`/companies`), the contribution forms, or the admin pages.

---

## Part B — the gate

### The rule

A viewer is **eligible** when both hold:

1. `users.email_verified` is true, and
2. they authored at least one company review, interview experience, or salary point in the last 365 days, with status `pending` or `published`, on any company — subject to D2 and D4.

### Where it is enforced — the no-leak requirement

The ask is explicit that ineligible viewers must not receive the data in any network response. That rules out the obvious implementation, and the plan says so up front:

> **A CSS blur is not a gate.** Blurring real content client-side leaves it in the RSC payload, in view-source, and one devtools toggle away. The same applies to rendering the real page server-side and hiding parts with `hidden`. The blurred mockup must be **synthetic placeholder content that never touched the database** — a static fixture, the same for every company — and the real rows must not be fetched at all when the viewer is ineligible.

Concretely:

- A new **`contributorProcedure`** in `packages/api/src/trpc.ts`, layered on `protectedProcedure` the way `verifiedProcedure` already is, throwing `FORBIDDEN` with a machine-readable reason (`needs_verification` / `needs_contribution`) so the UI can say which half failed.
- `companies.reviews`, `companies.interviews`, `companies.salaries`, `companies.responses` move from `publicProcedure` to `contributorProcedure`. `companies.bySlug` **splits**: a public projection returning only the facts tier (D1b), and the gated remainder.
- The page **branches before it loads**: `load(slug)` checks eligibility first and calls only the procedures the viewer may see. The ineligible path renders the facts tier plus the synthetic mockup, so no real review text, pay figure, or interview detail enters the HTML, the flight stream, or any XHR.
- `generateMetadata` is audited: `title` and `description` may carry the company's own name and description (facts tier), never contributed content.
- **`search`** (S14) is audited in the same pass: it returns company `name`, `industry` and `description` — all facts tier, so it stays as-is under D1b — but the plan requires the check to be made and written down, because a gate with a search-shaped hole is not a gate.
- The directory `/companies` and `company_stats` aggregates stay public under D1b (counts and averages are the teaser). Under D1a they gate too, which is a larger change and is why D1 is a decision and not a detail.

### Schema

No new tables. One migration, `0014_contribution_gate_indexes`:

- `company_reviews (author_id, created_at desc)`, `interview_experiences (author_id, created_at desc)`, `salary_points (author_id, created_at desc)`.

These do not exist today and cannot be served by what does: the two author indexes are `unique (organization_id, author_id)`, so an author-only lookup cannot use them. Eligibility runs on every company page view, so it needs the index before it needs anything else.

Eligibility is **one query, not three** — a `union all` of three `exists` probes, or a single `select 1 … limit 1` per table short-circuited in order of likelihood — resolved in implementation and recorded in `review.md` with the plan chosen.

### Caching and correctness

Eligibility is per-user and changes the moment someone contributes. The company page is already dynamic and uncached (S10a, and confirmed again this week), so there is no cache to invalidate — but the S10a lesson applies in reverse: **do not add a cache here**, because a cached eligible render served to an ineligible viewer is a data leak, not a stale page.

### Tests

- Unit: the eligibility predicate across every combination — unverified, verified with no contribution, verified with a contribution at 364 and 366 days, `pending`, `published`, `rejected`, `hidden`, admin, mentor, company member, signed out.
- Integration: each gated procedure refuses an ineligible caller and returns data to an eligible one.
- **Leak tests, following the precedent already set twice in this repo** (S4's "correct answers never reach the client" on the RSC payload, S6's "comments' text is not in the server HTML"): fetch a company page as an ineligible viewer and assert the response body contains no review text, no pay figure, and no interview detail from the fixture. This is the acceptance criterion that matters most and it must be a test, not a browser observation.
- The existing S10a/S10b/S10c suites still pass, with their callers made eligible.
- Browser loop (required — this touches UI): `/companies`, `/companies/[slug]`, signed out, signed in unverified, verified without contribution, verified with contribution, admin, company member; light and dark; desktop and 390px; at least two fix-and-reload rounds recorded in `test.md`.

### Files to touch

| Path                                                     | Change                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/api/src/trpc.ts`                               | `contributorProcedure`, eligibility helper                    |
| `packages/api/src/routers/companies.ts`                  | procedure swaps, `bySlug` split into facts tier + gated       |
| `packages/api/src/routers/search.ts`                     | audit; change only if D1a                                     |
| `packages/database/src/schema/companies.ts` + `drizzle/` | three indexes, migration `0014_contribution_gate_indexes`     |
| `apps/lms/app/companies/[slug]/page.tsx`                 | branch before load; re-ordered hierarchy                      |
| `apps/lms/components/companies/*`                        | at-a-glance strip, gate wall, synthetic mockup, heading fixes |
| `docs/requirements.md`                                   | rewrite F2.14 per D1; note the gate under F2.8                |
| `docs/policy/content-policy.md`                          | audit: the policy describes a public bank                     |

### Acceptance criteria

- [x] An ineligible viewer's page response contains no contributed content — asserted on the response body, not observed in a browser — and the ineligible path issues no request that would return it.
- [x] The blurred state is synthetic content that never touched the database; the real rows are not fetched for an ineligible viewer.
- [x] Each gated procedure refuses an ineligible caller directly, so the gate holds against a hand-made API call, not only through the UI.
- [x] Verified email plus one contribution in the last 365 days grants access; 366 days does not; a rejected contribution does not; a pending one does.
- [x] Admins, mentors, and a company's own members are not walled out.
- [x] The facts tier stays public and indexable, and F2.14 is rewritten to say exactly what is now true.
- [ ] Sub-scores are withheld below n = 5 and every average prints its n.
- [ ] The heading outline is one level per level, checked with a screen reader's heading list.
- [ ] On a 390px viewport the facts reach the reader before the opinions.
- [ ] Browser loop passed across all seven viewer states above, with at least two rounds recorded in `test.md`.

### Risks

- **The gate raises the moderation load and lowers its quality.** It makes "submit something, anything" the price of entry, which is exactly the incentive the S5 queue was not designed for. Watch the rejection rate after launch; if it climbs, D3 is the dial to turn.
- **It is a one-way door for SEO.** Pages that leave the index take months to return. This is the argument for D1b.
- **It punishes the lurker who would have contributed later.** Most people read a review bank several times before they write anything; this asks them to write first. D2a softens the launch but not the steady state.

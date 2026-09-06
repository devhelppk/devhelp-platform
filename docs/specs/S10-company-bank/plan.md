# S10 plan: company bank

Status: `planned`; founder answered the open points on 2026-09-07 (split confirmed, aggregates from a Postgres view, thin pages indexed, admins only) and corrected decision 1: a company is an organisation in Postgres, not a content-repo file. Spec entry: `docs/spec.md` → S10. Requirements: area 2 phase 1 (F2.1 to F2.14, N2.1 to N2.3); X2 (moderation), X3 (search, the company slice), X10. Builds on S1 (Better Auth organisations with `kind`, `city`, and `website` already on the table), S5 (moderation queue, flags, policy page, `verifiedProcedure`, rate limits), S6 (the review and rating patterns), S7 (public indexable pages with cache invalidation on a decision).

## Goal

A newcomer types a company name and gets a straight answer: what the place is, how it interviews, what it pays, and what working there is actually like, written by people who were there. Every contribution is anonymous in public and moderated before it appears, because the legal exposure in Pakistan is real. These pages are public, indexable, and the main reason a stranger finds devhelp at all.

## Size, and a proposal about it

This is the largest remaining spec: five new contribution types, a directory with search, aggregation with a small-sample rule, and a second moderation surface. I would rather ship it in two halves than carry one enormous branch:

- **S10a (this plan's core):** companies, proposals, reviews, interview experiences, the directory with search and filters, moderation, anonymity, indexable pages.
- **S10b (immediately after):** salary points, the aggregation with the n ≥ 5 rule, currency handling, and the salary section on the company page.

Everything below is written so the split is a clean cut: the salary sections are marked, and nothing in S10a depends on them. Founder to confirm the split or ask for one spec (open point 1).

## Decisions (verified 2026-09-07)

1. **A company is an organisation.** Founder decision: companies are not content. They are rows in Better Auth's `organizations` table, which already carries `name`, `slug`, `logo`, `kind`, `city`, and `website`, with `kind = "company"` telling them apart from the universities and communities S9 will use. Company-specific facts live in `company_profiles`, our own table keyed by the organisation id, so the generated `schema/auth.ts` is never hand-edited. Logos and any later files go to R2 through `@repo/storage` (S7), never into Postgres. This unifies three things that were drifting apart: an institution and an employer are the same kind of row, S13's "claim this profile" becomes ordinary organisation membership, and a company that also runs a cohort needs no second identity.

   Rows are created directly through Drizzle rather than the organisation plugin's endpoint, so `allowUserToCreateOrganization` stays restricted to mentors and admins: proposing a company must not hand anyone an organisation they control. Membership arrives only through a claim (S13).

   **The content repo loses companies.** `companies/arbisoft.yaml`, the `companyFile` schema, and the loader entry are removed, and that one company is re-created as a seeded row. Curated facts are edited by admins in the platform, not by pull request.

2. **Proposals go through the S5 queue.** `moderation_subject` gains `company_proposal`; a proposal snapshots the submitted fields, and approval creates the organisation (`kind = "company"`) and its profile, published and unverified. Duplicate proposals are caught before the queue by a name and domain check against `companies` and `company_aliases` (F2.2's dedupe); a moderator merging duplicates writes an alias row rather than deleting anything.
3. **Reviews and interviews are moderated before they are visible (N2.1).** This is the opposite of S6's course reviews, deliberately: a course review risks a bruised ego, a company review risks a defamation claim. On submission the row is `pending` and invisible to everyone but its author and admins; approval, by an admin only, publishes it and invalidates the company page. The S6 flag path applies afterwards.
4. **Anonymity is enforced by the column set, not by discipline.** Every public read goes through `reviewPublicColumns` / `interviewPublicColumns`, which cannot select `author_id`, and dates are exposed as `YYYY-MM` only (`created_month`, a generated column). The author id stays on the row for the one-per-company rule and for moderation, readable only by admin procedures. A test asserts that the serialised public payload contains no user id and no full date, the same shape as S4's quiz-answer test.
5. **Verified affiliation without revealing the address (F2.8).** At submission the server looks at the contributor's verified email domain: `.edu.pk` earns a `student` affiliation mark, a domain matching the company's website earns `employee`. The mark is stored on the contribution; the address never is, and the domain is not shown. Everything else is `unverified`, which is what the launch expects.
6. **Aggregates come from a plain Postgres view (`company_stats`).** Founder decision, for simplicity: a view is always current, needs no refresh on any moderation decision, and keeps one source of truth. The page cache absorbs the cost, since a company page is ISR and only re-renders when a contribution is approved. If a company ever collects enough contributions to make the view slow, it becomes materialised behind the same name with a refresh on approval, and nothing above it changes.

7. **Salaries are aggregates only, and the rule is enforced in the query (S10b).** Individual points are never selected by any public procedure. A cell (role, level, city) renders only with at least five points; otherwise it falls back to the role-level aggregate, and below five there too it says "not enough data". Percentiles come from `percentile_cont` in Postgres, not from JavaScript over fetched rows, so individual values never leave the database.
8. **Money is stored as it was earned (S10b).** `amount_minor` plus `currency` (PKR or USD) plus `period` (monthly), with the USD-to-PKR rate stored on the row at submission so a historical point does not drift with the exchange rate. Display shows PKR with the original USD alongside when that is what the person was paid.
9. **Search is Postgres, sized for the data we have.** A `search_vector` generated column over name, aliases, industry, cities, and stack, with a GIN index, plus `pg_trgm` on the name for "arbi" finding "Arbisoft". Filters (city, industry, stack, size, hires juniors, minimum rating) are plain indexed predicates. No search service until the catalogue justifies one; X3's wider search across lessons and comments stays in S14.
10. **Company pages are static with revalidation, and the directory is dynamic.** `/companies/[slug]` is ISR (`revalidate = 3600`) and invalidated by a server action when a contribution is approved or hidden, exactly as S7 does for certificates. `/companies` reads `searchParams`, so it is dynamic. Both are indexable; a company with no contributions still renders its facts, because an empty page that ranks is how the first contributor arrives.
11. **Cities and roles are reference tables, seeded from content.** (Companies are not; see decision 1.) `cities` (name, province) and `job_roles` (slug, name, family) so filters and salary rows group cleanly rather than on free text. Seeded from a `reference/` folder in the content repo, synced like everything else. Contributions pick from the list with a free-text fallback that a moderator maps.
12. **One review and one salary point per company per person, interviews limited per month (F2.11).** Unique indexes for the first two; `rateLimit` for the third. A rejected contribution does not free the slot until its author edits and resubmits, which is the same shape S6 uses for held comments.
13. **The company page is one screen, in the order a newcomer reads.** Facts and aggregate rating at the top, then "how they interview" (difficulty distribution, rounds, recent experiences), then culture (reviews with sub-ratings), then pay (S10b), then the courses cross-link stub (S13 fills it). Contribution buttons sit beside each section rather than in one form, because people arrive wanting to say one thing.

## Schema (migration `0013_company_bank`)

- `company_profiles`: `organization_id` (primary key, references `organizations`), `description`, `industry`, `size`, `cities` text[], `founded`, `stack` text[], `hires_juniors`, `careers_url`, `linkedin`, `sources` jsonb, `status` (pending, published, hidden), `verified_at`, `verified_by`, `proposed_by`, `logo_key` (R2), `search_vector` generated over the organisation name, aliases, industry, cities, and stack, timestamps. The organisation carries name, slug, logo, city, and website; this table carries everything a company page needs beyond that.
- `company_aliases`: `organization_id`, `alias`, unique on lower(alias), for dedupe and search.
- `company_reviews`: `organization_id`, `author_id`, `status`, `rating`, sub-ratings (`learning`, `management`, `work_life`, `compensation`, `growth`), `role_id`, `employment_status`, `tenure_band`, `city_id`, `pros`, `cons`, `advice`, `would_recommend`, `affiliation`, `created_month` generated, timestamps; unique (company, author).
- `interview_experiences`: `organization_id`, `author_id`, `status`, `role_id`, `level`, `year_month`, `source`, `rounds` jsonb (validated by `interviewRoundsSchema`), `difficulty`, `duration_days`, `outcome`, `questions`, `advice`, `affiliation`, timestamps.
- `salary_points` (S10b): `organization_id`, `author_id`, `status`, `role_id`, `level`, `years_experience`, `city_id`, `employment_type`, `amount_minor`, `currency`, `period`, `usd_rate`, `has_bonus`, `has_equity`, `is_remote`, `year`, timestamps; unique (company, author).
- `cities`, `job_roles`: reference tables synced from the content repo.
- `company_stats`: a view over the published contributions per organisation (average and count per rating and sub-rating, interview difficulty distribution, contribution counts), read by the company page and the directory.
- Enums: `company_status`, `contribution_status` (pending, published, hidden, rejected), `employment_status`, `tenure_band`, `interview_source`, `interview_outcome`, `affiliation` (unverified, student, employee). `moderation_subject` gains `company_proposal`, `company_review`, `interview_experience`, and (S10b) `salary_point`.

## API (`packages/api`)

- `companies` router: `list({ q, city, industry, stack, size, hiresJuniors, minRating, sort, cursor })`, `bySlug(slug)` (facts, aggregates, published contributions through the public column sets), `propose(...)` (verified, rate limited, dedupe check), `mine` (the caller's own contributions with status).
- `contributions` router: `submitReview`, `submitInterview`, `submitSalary` (S10b), each verified, rate limited, one-per-company where the rule says so, opening a moderation item; `editMine` while pending or rejected.
- `moderation.decide` gains the company subjects, admin-only (the legal exposure is real and the policy is new): approve publishes and invalidates the page, reject hides with the policy clause, merge writes an alias.
- Admin: `companies.merge({ from, into })`, `companies.verify(slug)`, and `companies.updateFacts(slug, ...)`, since curated facts are now edited on the platform rather than by pull request.

## UI

| Route (LMS)                    | What                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `/companies`                   | Directory: search box, filters, cards with rating, review count, cities, "hires juniors"       |
| `/companies/[slug]`            | The one-screen page in decision 13, with contribution buttons per section                      |
| `/companies/[slug]/interviews` | Full interview list with role and outcome filters when a company has many                      |
| `/companies/propose`           | Propose a company (verified email)                                                             |
| `/contribute/[slug]/review`    | Review form with sub-ratings; interview and salary forms alongside                             |
| `/account` → contributions     | The caller's own submissions with status and the moderator's reason                            |
| `/moderate`                    | Gains the company subjects; the item detail renders the submission and the company it concerns |

## Tests

1. `@repo/api` (Postgres): a pending review is invisible to everyone but its author and moderators; approval publishes it and moves the aggregate; the public payload for a company contains no `author_id` and no full date (serialisation test); one review per company per person; interview rate limit; affiliation is derived from the verified email domain and the address never appears in output; proposal dedupe by name, alias, and website domain; merging writes an alias and moves contributions; salary aggregates return nothing below five points and fall back to the role level (S10b); percentiles come from the database.
2. `@repo/content` and `@repo/content-schema`: cities and roles sync; removing the company schema and file leaves the content check green, and the seeded company arrives as an organisation row.
3. LMS (jsdom): directory filter chips, the review form's sub-rating inputs, the "not enough data" salary cell.
4. Browser loop (spec rule): propose a company as a verified learner → it is invisible → an admin approves → the page renders with facts → submit a review and an interview → both invisible until approved → approve → they appear anonymised with a month, not a date → the aggregate rating moves → flag one and uphold it → it disappears → search finds the company by a prefix and by city → light and dark, desktop and 390 px, console clean, at least two fix-and-reload iterations, screenshots saved.
5. Full pipeline and the bundle budget, plus a check that the company page is served from cache and revalidates after an approval.

## Out of scope

Company claims and public responses (S13), cross-links to courses (S13), job openings, verification mechanics beyond the affiliation mark, exports, employer accounts, salary charts beyond the aggregate table, X3's platform-wide search (S14).

## Acceptance criteria (from spec.md)

- [ ] Public payloads and APIs contain no user ids or exact dates (test on serialisation).
- [ ] Salary cells with n < 5 fall back to the role aggregate or "not enough data" (S10b).
- [ ] Reviews and interviews are invisible until approved; one review and one salary point per company per user.
- [ ] Company page is static-rendered and revalidates on approval.
- [ ] Browser loop passed on the dev server for the flows in test item 4; at least two fix-and-reload iterations recorded in `test.md`.

## Open points for the founder

All four settled on 2026-09-07. The spec is split into S10a (this plan) and S10b (salaries). Aggregates come from a plain Postgres view (decision 6). A company page with facts and no contributions is published and indexed (decision 10). Only admins approve company contributions (decision 3 and the moderation section); mentors can be added once the policy has been exercised. Decision 1 was rewritten in the same message: a company is an organisation in Postgres with its files in R2, and the content repo loses companies entirely.

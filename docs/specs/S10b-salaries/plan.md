# S10b. Company bank: salaries

Scope: F2.6, F2.7, and the salary half of F2.11. The other half of the company bank shipped as S10a (`f876eb5`); this adds what people are paid.

## Decisions

Four settled with the founder on 2026-09-07, three of them by question.

1. **Salaries are shown in the currency they were earned in.** Remote work for foreign employers is common, and a monthly PKR figure and a monthly USD figure are different facts about different jobs; averaging them into one number would hide that. Aggregates are grouped by currency, so a role can show a PKR row and a USD row side by side. Conversion is offered as a convenience on top, never as the stored truth.

2. **Conversion comes from an `fx_rates` table, refreshed daily from an exchange-rate API.** The platform never calls the API on a request path: a script (`pnpm fx:refresh`, a daily cron in production) writes one row a day, and everything else reads the table. If the table is empty or stale the page simply does not offer the converted figure. The rate in force at submission is also copied onto the salary point, so what a 2023 figure was worth in 2023 stays fixed even as the rate moves.

3. **Salary points publish immediately and carry an `unverified` mark until an admin reviews them.** A salary point is a number and four dropdowns; there is no prose to read, and holding it in a queue would buy nothing except a growing queue. The real protection is the aggregation floor: no individual point is ever visible, so a point that publishes instantly is still invisible on its own. An admin sees every one in the moderation queue and can mark it checked or hide it, which is the same audit trail every other contribution has.

   This is the one place in the bank where a contribution is visible before a human has looked at it, so ordinary input validation still applies: a positive amount inside a wide absolute range, a year that is not in the future, and years of experience that fit a career. That is bounds checking on a form field, not a judgement about whether the figure is true.

4. **The floor stays at n ≥ 5 for every cell**, as F2.6 specifies, including the finest role × level × city breakdown.

   **Revised during the code review.** The floor alone turned out not to deliver what it promised: `percentile_cont` lands exactly on raw values at n = 5, so the quartiles were three of those five people's real salaries. Published figures are now rounded to a per-currency step, and the middle half is withheld below n = 8. The floor is unchanged; it is simply no longer the only rule. See `review.md`.

## Schema

Migration `0014_salaries`.

- `salary_points`: `organization_id`, `author_id`, `status` (`contribution_status`, defaulting to `published`), `role_id`, `role_text`, `level`, `years_experience`, `city_id`, `employment_type`, `amount_minor`, `currency`, `period`, `fx_rate_to_pkr` (the rate at submission, null for PKR), `has_bonus`, `has_equity`, `is_remote`, `year`, `affiliation`, `verified_at`, `verified_by`, timestamps. Unique on (organization, author): one point per company per person (F2.11).

  A generated `monthly_minor` normalises a yearly figure to a month, so monthly and yearly submissions aggregate together. It is arithmetic over the row's own columns, so unlike S10a's two failed attempts it really is immutable.

- `fx_rates`: `base`, `quote`, `rate`, `as_of` (date), `source`, `fetched_at`. Primary key on (base, quote, as_of), so a re-run on the same day overwrites rather than duplicates.

- New enums: `salary_currency` (PKR, USD), `salary_period` (monthly, yearly), `employment_type` (full_time, part_time, contract, internship). `moderation_subject` gains `salary_point`.

- Two views, both **plain** like `company_stats`, and both enforcing the floor in a `HAVING` clause rather than in the query that reads them:

  - `salary_stats`: one row per (organization, role, currency), with `n`, `p25`, `median`, `p75` from `percentile_cont` over `monthly_minor`.
  - `salary_stats_detail`: the same, per (organization, role, level, city, currency).

  Putting `HAVING count(*) >= 5` inside the views is the point. An individual salary is then not merely something the routers decline to select; it is unreachable through the public path, and a future careless query cannot leak one.

## API

- `companies.salaries({ slug })`: the role-level rows, the detail rows, and the latest PKR rate, so the page can render the fallback hierarchy without a second round trip. Detail cells that did not clear the floor are simply absent, and the page falls back to the role row, then to "not enough data".
- `contributions.submitSalary`: verified email, rate limited, one per company, publishes at once as unverified, and opens a moderation item for the admin record.
- `fx.latest` for the converted display.

Percentiles are computed by Postgres. No procedure selects `amount_minor` from a row.

## Pages

- A **Pay** section on the company page, after culture and before the courses cross-link, per the S10a reading order: one table per currency, role rows, expandable to level and city where the data clears the floor, with the count shown so a reader knows how thin a number is.
- A **salary tab** on the existing contribute form, beside Review and Interview.
- The moderation item renders the figure, and an admin can mark it checked or hide it.

## Tests

1. `@repo/api` (Postgres): a cell with four points returns nothing and falls back to the role row; the fifth point makes it appear; no public payload contains `amount_minor` for an individual or an author id; percentiles match hand-computed values; a yearly submission aggregates with monthly ones; PKR and USD aggregate separately; one point per company per person; a hidden point leaves the aggregate; a future year and an absurd amount are refused.
2. LMS (jsdom): the "not enough data" cell.
3. Browser loop: the Pay section with and without enough data, the salary form, and the moderation view, in both themes at both widths.

## Out of scope

Verification mechanics beyond the mark, salary charts, exports, per-level city heat maps, and anything that would let a reader reconstruct an individual point.

## Acceptance criteria

- [ ] Salary cells with n < 5 fall back to the role aggregate or "not enough data".
- [ ] One salary point per company per user; individual points never appear in any public payload.
- [ ] Percentiles are computed in Postgres, not over fetched rows.
- [ ] Salaries display in the currency submitted, with conversion from the rate table only as an aid.
- [ ] Browser loop passed, at least two fix-and-reload iterations recorded in `test.md`.

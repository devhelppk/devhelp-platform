# S10a test record

Date: 2026-09-07. Local Postgres 17, Mailpit, and MinIO from `docker-compose.yml`; dev server `pnpm dev` (lms on 3001); content pinned to `devhelp-content@ee92c5a` (the commit that removes `companies/`). The dev database was rebuilt from migration `0000` so `0013_company_bank` is exercised from scratch, then seeded with `pnpm db:seed`, which now also loads the reference cities and job roles and creates one published company.

## Automated

| Suite                  | Tests     | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/api` (Postgres) | 58 (+20)  | a published company lists and resolves by slug while a pending one is invisible to both; an alias finds a company; a review is held pending, is absent from the list and from the aggregates, publishes on approval and then moves `rating_avg` and `recommend_pct`; a public review payload has no `authorId` and no user id anywhere in it, and carries a `YYYY-MM` month; a second review from the same person edits the one row and returns it to pending, reusing the same queue item; an employee is recognised from the email domain and the address is not stored on the row; an interview publishes with its rounds and never leaks the author; a future-dated interview is refused; an unverified account cannot contribute; hiding a published review drops it from the aggregates and sets `hidden`; a mentor neither sees nor can decide a company item; a proposal creates an invisible company that appears on approval and shows on the proposer's contributions; a duplicate proposal is refused by name and by alias; an admin edits facts, is recorded as having checked them, and leaves contributions untouched; facts editing and the admin list refuse everyone but admins; a rejected review stays rejected when its author rewrites it and its queue item is not reopened; an edit that omits advice, a sub-score, and tenure clears all three; an unanswered recommendation stores null rather than a no; a duplicate proposal is refused whatever the case; a name that is a single `%` proposes successfully instead of colliding; hiding a company keeps the record that its facts were checked, and unhiding records the deciding admin |
| Repo pipeline          | all tasks | `format:check && lint && check-types && test && build` clean; `pnpm check-budget` against `next start`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

The `0013_company_bank` migration was also replayed statement by statement onto an empty database with `psql -v ON_ERROR_STOP=1`, both file-by-file and inside a single transaction, after two generated columns turned out not to be immutable (see `review.md`). The database was dropped and rebuilt from `0000` twice more while the migration changed, most recently to add the partial unique index on company names.

## Bundle budget

`/companies` and `/companies/arbisoft` were added to `scripts/check-bundle-budget.ts`. Both measure 192 KB gzipped first-load JS, the same as `/courses`, because the directory filters are a plain GET form and the company page ships no client island at all.

| Page                  | First-load JS (gz) | Target | Ceiling |
| --------------------- | ------------------ | ------ | ------- |
| `/companies`          | 192 KB             | 250 KB | 300 KB  |
| `/companies/arbisoft` | 192 KB             | 250 KB | 300 KB  |

## Browser loop (Chrome, dev server)

Three rounds, driven by a `playwright-core` script over eight routes (`/companies`, a company page, contribute, propose, both admin pages, `/account/contributions`, `/moderate`) in light and dark at 1440 px and 390 px: 32 screenshots a round, with console errors, page errors, HTTP status, and horizontal overflow asserted on every combination. The signed-in pass used a throwaway account created through the sign-up endpoint and promoted to admin in the database, so no password was typed into a form.

Console clean and no horizontal overflow on every page, theme, and width in all three rounds.

Round 1 found:

- **Stars lied about the score.** The fill was `Math.round(value)`, so 3.5 drew four filled stars beside the text "3.5", and in dark mode the empty stars were nearly the same colour as the filled ones.
- **A void beside the company header.** The description and technology badges were inside the full-width header, so the Facts aside began level with the reviews and left roughly 200 px of empty column above it on desktop.
- **The admin facts page never said which company it was editing.** The heading read "Company facts" on every company.
- **The directory did not say how many companies matched**, so an empty filtered result was indistinguishable from a bank with nothing in it.
- **The 1–5 scales gave no sense of direction.** Five numbered boxes with no idea whether 1 or 5 was the good end.

Round 1 fixes: the star fill is clipped to the exact percentage over a track in a real border colour, so 3.5 reads as three and a half in both themes; the description and badges moved into the left grid column so the aside starts beside them; the admin heading names the company, read on the server, with a line saying contributions are decided elsewhere; the directory states the result count in a live region; the scales carry "Poor"/"Great" end labels, and "Easy"/"Brutal" on interview difficulty.

Round 2 found:

- **The contribution month stranded itself mid-row on narrow.** `ml-auto` on a wrapping flex row put "September 2026" between the role and the tenure instead of at the end.

Round 2 fix: the month takes a full line below `sm` and only floats right from `sm` up.

Round 3: clean on all 32 combinations, no findings.

Round 4 ran after the code-review fixes changed the contribute form (the recommendation became a three-way select and an interview round description became required): clean on all 32 combinations. Screenshots in `screenshots/` are from this round.

## The moderation round trip, in the browser

Driven end to end with Playwright against the dev server, because this is the behaviour the spec's freshness criterion is really about.

| Step                                                                | Result                  |
| ------------------------------------------------------------------- | ----------------------- |
| Review written through the form on `/companies/arbisoft/contribute` | Submitted, held pending |
| Public company page, before any decision                            | Review not present      |
| Approved from `/moderate/<id>`                                      | Decision recorded       |
| Public company page, immediately after                              | Review present          |
| Hidden from `/moderate/<id>` with a reason                          | Decision recorded       |
| Public company page, immediately after                              | Review gone             |

This flow is what found the caching problem in `review.md`: on the cached build, the last two rows read "review absent" and "review still present" respectively, the second for about twelve seconds. Both are immediate now.

## Checked by hand

- A pending proposal is invisible at its own URL, not merely absent from the directory.
- `pnpm db:reference` run twice inserts thirteen cities and fourteen job roles the first time and reports the same counts with no change the second.
- `pnpm content:check` and `pnpm content:sync` pass against the content repo with `companies/` removed, and the loader no longer reads that directory.

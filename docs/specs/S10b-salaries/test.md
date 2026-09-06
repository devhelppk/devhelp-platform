# S10b test record

Date: 2026-09-07. Local Postgres 17, Mailpit, and MinIO from `docker-compose.yml`; dev server `pnpm dev`; migration `0014_salaries` applied on top of the S10a database.

## Automated

| Suite                  | Tests     | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/api` (Postgres) | 72 (+14)  | four reports return nothing and the fifth makes the role appear; at five reports the middle half is withheld, because `percentile_cont` would otherwise publish three of those five people's exact pay; five deliberately non-round salaries produce a median that is neither the middle value nor any of the five, and is a multiple of the rounding step; at eight reports the quartiles appear, also rounded; internships and figures older than three years stay out of the staff aggregate; no public payload contains an amount, an author id, or any contributor's id; a contributor sees their own figure and nobody else's; PKR and USD aggregate separately and the conversion is an aid on top of an unchanged figure; five yearly reports of 1,200,000 aggregate as monthly 100,000s; a level and city cell stays absent at four points and appears at five; a point publishes at once as unverified and approving marks it checked without changing its visibility; hiding a point drops it from the aggregate and a resubmit does not put it back; one point per company per person, with the second submission replacing the first; a future year, an absurd amount, and a negative amount are all refused |
| Repo pipeline          | all tasks | `format:check && lint && check-types && test && build` clean; `pnpm check-budget` against `next start`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

The salary suite seeds its own exchange rate rather than relying on one being present, and was run against an emptied `fx_rates` table to prove it passes the way CI will see it — CI has no network step for `fx:refresh`, and the same shape of assumption broke the budget check in S10a.

Three behaviours are enforced by the schema rather than by a test that could rot: the `n >= 5` floor and the rounding both live inside `salary_stats` and `salary_stats_detail`, and the one-point-per-person rule is a unique index. The tests exercise all three, but a future careless query cannot get past any of them.

The privacy tests were rewritten after the code review: the first version asserted the exact figures five people had submitted, which is to say it asserted the leak. See `review.md`.

## Bundle budget

Unchanged at 192 KB gzipped first-load JS for `/companies/arbisoft`: the Pay section is server-rendered and ships no client JavaScript.

## Browser loop (Chrome, dev server)

Three rounds over the same eight routes as S10a in light and dark at 1440 px and 390 px, with console errors, page errors, HTTP status, and horizontal overflow asserted on all 32 combinations, plus a fourth pass that opens the pay tab and the moderation view specifically. The company page was seeded with nineteen published points: two roles that clear the floor, a senior Lahore cell that clears it, a USD role, and a fourth role with only four points that must stay invisible.

Round 1 found:

- **The page scrolled sideways on a phone, by 202 px.** The pay table had a minimum width and sat in an `overflow-x-auto` container, but a grid item does not shrink below its content by default, so the table pushed the whole page wide instead of scrolling inside its own box.
- **Breakdown rows repeated the role row.** A cell with no level and no city rendered as "Other: USD 3,500 (n = 5)" directly under a role row already reading USD 3,500, which reads like two different facts.

Round 1 fixes: `min-w-0` on the grid column; cells with neither a level nor a city are dropped, because the role row already says it.

Round 2 found:

- **The table scrolled but clipped with no cue.** With the overflow contained, the four-column table was cut off mid-word at 390 px and nothing suggested there was more to the right.

Round 2 fix: below `sm` the same figures render as a list of cards, one per role, with the median, the middle half, the count, and any finer cells. The table is used from `sm` up.

Round 3: clean on all 32 combinations. The pay tab and moderation pass found the contribution page still promising that "an administrator reads every contribution before it is published", which stopped being true for pay; the intro and the confirmation now say what actually happens to each kind. Currency, period, and employment type were also given their obvious defaults so the common case needs three fields, not six.

Round 4, after adding the contributor's own figure to `/account/contributions`: clean, except that a `capitalize` class was title-casing values it was never meant to touch ("Backend Engineer · PKR 275,000 / Month", "No Response"). The class is gone and the one value that needed sentence case is mapped explicitly.

Round 5, after the code-review fixes changed what the pay section shows: clean on all 32 combinations. A role with five reports now reads "The middle half needs eight reports" instead of showing quartiles, each row says which years it covers, and the footnote explains what is counted and that figures are rounded.

## The contribution round trip, in the browser

Submitted a salary point through the form as a signed-in learner and checked the effect on the aggregate:

| Step                                           | Result                                |
| ---------------------------------------------- | ------------------------------------- |
| Backend engineer, PKR, before                  | n = 10, median PKR 290,000            |
| PKR 275,000 submitted through the pay tab      | Confirmation says it already counts   |
| Backend engineer, PKR, after                   | n = 11, median PKR 275,000            |
| Fourth role with only four reports, throughout | Absent from the page and from the API |

## Checked by hand

- `pnpm fx:refresh` writes one row and re-running on the same day overwrites rather than duplicating.
- With `fx_rates` emptied, the company page still renders every figure and simply omits the converted line.
- The aggregates behave as the views intend, read straight from Postgres: a five-report role has a rounded median and null quartiles; an eleven-report role has quartiles rounded to the nearest 5,000 rupees.

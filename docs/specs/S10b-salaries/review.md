# S10b review record

`/code-review high` ran on the S10b working tree and reported seven findings, one high. All were verified and fixed.

The high one is the important one, and it is worth stating plainly: **the spec's central privacy promise did not hold, and the test I wrote demonstrated the leak instead of guarding against it.**

## 1. The `n ≥ 5` floor did not stop individual salaries being published (high)

`percentile_cont(p)` interpolates at index `p × (n − 1)`. At n = 5 that is index 1, 2 and 3 — no interpolation at all — so `p25`, `median` and `p75` were the 2nd, 3rd and 4th sorted values verbatim: three of those five people's exact monthly pay. A `salary_stats_detail` cell is role × level × city, so five colleagues in one team at one company meant anyone who knew two of them could read a third's salary off a public page.

Worse, `salaries.test.ts` submitted 110k / 120k / 130k / 140k / 200k from five distinct users and asserted the published quartiles were 120k, 130k and 140k. It asserted the leak was working. And three comments shipped in the same diff claimed the opposite: "no individual amount ever leaves the database", "nothing here can return an individual salary even by mistake", "there is no code path that could render an individual salary".

The fix is three rules in the views, none of which is sufficient alone:

- The floor stays: a cell needs five people to exist.
- **Published figures are rounded** to a per-currency step (PKR 5,000, USD 50), so what appears is a band rather than anybody's number.
- **The middle half is withheld below n = 8.** Publishing three order statistics of five people says far more about those five than publishing one does.

What none of this can do is stop someone who already knows four of five salaries from narrowing the fifth. That is true of every aggregate, and the migration now says so in place of the claims it used to make. The tests were rewritten to assert the protections: deliberately non-round inputs whose median must not survive rounding, null quartiles at n = 5, and rounded quartiles at n = 8.

## 2. Unrelated facts averaged into one number (medium)

The views grouped only by company, role and currency, with no year window and no employment filter. Three interns reporting 30,000 and two engineers reporting 400,000 for the same role published a median of 30,000, which the page rendered as "PKR 30,000 a month, typically" for that role. A figure from 2005 sat in the same median as one from 2026.

Both views now exclude internships and restrict to the last three years, and they return the first and last year in the set so the page can say what period a row covers. The footnote says what is counted.

## 3 to 7

| #   | Finding                                                                                                                                                                                                                   | Fix                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 3   | Widening the hide form to pending salary points put two textareas with `id="reason"` on the page, so the "Hide with reason" label focused the reject box and a screen reader announced the wrong field.                   | The hide textarea is `hide-reason`.                                                          |
| 4   | `cityId` was looked up only for the queue snapshot; an unknown but well-formed uuid reached the foreign key and surfaced as an unhandled Postgres error rather than a bad request. `roleId` was already checked properly. | An unknown city is a `BAD_REQUEST`, like an unknown role.                                    |
| 5   | `amount` was `positive()`, so 0.004 passed validation, rounded to zero minor units, published, counted towards the floor, and dragged the median down. The only real floor was an HTML `min` attribute.                   | `min(1)` on the server.                                                                      |
| 6   | `latestUsdToPkr` returned the newest row whatever its age, so a stopped cron would have kept rendering "≈ PKR …" from a months-old rate, contradicting both the module's own comment and the plan.                        | A rate older than fourteen days is treated as absent, and the page then shows no conversion. |
| 7   | `level` was free text and a `GROUP BY` key, so "Senior", "senior" and "Sr" were three cells that would each struggle to reach five, and two casings clearing the floor would render as duplicate rows under one role.     | A fixed list in `packages/api/src/levels.ts`, used by both the Zod input and the form.       |

## Found while fixing

**A client component pulled `postgres` into the browser bundle.** Importing the level list from the `@repo/api` index re-exported the whole tRPC tree, and the production build failed on `Can't resolve 'fs'`. The list moved to `packages/api/src/levels.ts`, a leaf module with no imports, exported as `@repo/api/levels`. The dev server never noticed; only `pnpm build` did, which is the same shape as the S4 worker problem.

**One flaky failure in `api.test.ts`.** `can complete the course again after drop and re-enrol` failed once during a full parallel run and passed on rerun and in every run since. This is the same intermittent failure recorded in the S8 review, on the same test, and S10b does not touch that path. Recorded rather than explained away.

## Not fixed, deliberately

- **The plan's jsdom test for the "not enough data" cell was not written.** The state is covered by the API tests and by the browser loop, and a jsdom test of a server component's markup would mostly restate the component. Noted rather than quietly dropped.
- **`salary_points.fx_rate_to_pkr` is written and never read.** Display uses the current rate, because someone comparing offers wants today's money. The column records what a figure was worth when it was reported, so that a historical view is possible later without having lost the information. The comment now says exactly this rather than implying it is in use.
- **`salaryQueueItem` duplicates `queueItem`.** The two differ in payload type and subject; folding them would need a generic that is harder to read than the copy. Worth revisiting if a fourth contribution kind appears.

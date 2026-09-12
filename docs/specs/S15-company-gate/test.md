# S15 part A — company page hierarchy: what was tested

Part A only (the design pass). The gate (part B) is not built; its three founder decisions are still open.

Environment: dev server on :3001 against local Postgres with the seeded `arbisoft` fixture (2 reviews, 1 interview, pay for 2 roles, one company reply). Signed in as an admin account. Chrome, viewports 1440×900 and 390×844, dark and light.

## Iteration 1

Changes: at-a-glance strip with jump links; recommend rate promoted out of the score-bar card; sub-scores withheld below 5 reviews; sections reordered to Pay → Reviews → Interviews with anchors; `Facts` moved first in the DOM with explicit `lg:col-start-2` placement; card field labels changed from `<h3>` to `<p>`.

Found:

- **The description and stack badges ended up below the `Facts` card on mobile.** Moving `Facts` up pushed identity prose below it, so the reading order became name → numbers → facts table → "what this company actually does". Fixed in iteration 2 by lifting the description and stack out of the grid to sit directly under the at-a-glance strip.

## Iteration 2

Changes: description and stack moved above the grid.

Found, and this is the one worth recording:

- **The browser kept rendering the old order for several minutes after the source was correct.** An earlier botched block move had briefly left an orphaned `) : null}` in the page. `next dev` failed to parse it and **kept serving the last good compile** — still answering `200`, with no error in the response — and it went on doing that after the file was repaired and type-checking cleanly. Every signal except the dev server's own stdout said the page was fine.

  The tooling behaved correctly at every other point, which is worth stating precisely because the first version of this note blamed the wrong thing: `pnpm check-types` **did** report the break while it existed (`app/companies/[slug]/page.tsx(453,7): error TS1005`), and turbo did not mask it. The only broken link was Turbopack's recovery.

  Diagnosed by comparing `curl` output against the source — the served HTML disagreed with the file — and then by reading the dev log for `Parsing ecmascript source code failed`. Fixed by stopping the server, removing `apps/lms/.next`, and restarting; a plain restart was not enough. Now written up in `AGENTS.md` with a `pnpm dev:lms:clean` script.

## Final verification

DOM order asserted from the served HTML, not from the screenshot:

```
would recommend (at a glance)  10023
description                    11091
Facts                          14903
id="pay"                       15884
id="reviews"                   21473
id="interviews"                28642
```

- **1440×900, dark and light.** `Facts` sits in the right column from `lg` up, as before. Pay leads the content column. The at-a-glance strip reads `50% would recommend · 2 roles with pay · 2 reviews · 1 interview`.
- **390×844, dark.** Order is header → actions → at a glance → description and stack → Facts → Pay → Reviews → Interviews. The facts now reach a phone reader before any contributed content, which was the finding that started this.
- **Low-n guard.** With 2 reviews the five score bars are replaced by: "Scores for learning, management, work/life, pay and growth appear once 5 people have reviewed Arbisoft. With 2, a single review would move each one too far to mean anything." Verified in both themes.
- **Console clean** on load: React DevTools notice and HMR only, no errors, warnings, or hydration mismatches.
- **Heading outline.** `page.tsx` now contains no `<h3>`; the only `h3` left in the company page tree is the role name in `pay.tsx`, which is a genuine subsection of the `Pay` `h2`.
- Gate: `format`, `lint --force`, `check-types --force`, `test --force`, `build --force` all pass.

## Checked and dismissed

- **The empty grey box where the company logo should be**, seen in the first desktop capture, is not a bug. The mark was mid-load; it renders correctly on every later capture and at every width. S10c's fallback chain is intact.
- **The `Report` control's prominence.** Flagged from a text dump of the page, where "Sign in to report" repeated under every card. Rendered, it is a small muted ghost link and reads as the quiet affordance it should be. Left alone.
- **The Pay table overflowing between 640px and 1024px**, recorded as unverified in the plan. It does not overflow: the main column carries `min-w-0` specifically to prevent it, with a comment saying so. No change needed, and the plan's note is resolved.

## Not done, deliberately

- **The header action cluster** — primary "Share your experience", ghost "Do you work here?", outline "Careers" — still reads as two buttons with a text link stranded between them. Every fix considered (making the claim link an outline, reordering) traded one imbalance for another, so it was left as it is rather than churned.
- **The right column is empty below `Facts`** for most of the page's height. Inherent to a short sidebar beside long content; filling it is a design question, not a defect.

---

# S15 part A2 — tabs, filters, and the search-param layer

A second pass on the same page, on founder direction after looking at part A: the header's three buttons, a fixed frame, a wider shell, filters, and "too text heavy".

## What shipped

- **Tabs** — Overview / Reviews / Interviews / Pay / About, in a bar that sticks under the site header. Each is a real `?tab=` URL.
- **Filters** inside Reviews and Interviews (role, plus employment status or outcome), appearing only at six or more rows.
- **Directory filters apply on change**; the Apply button is gone and the search box is debounced at 350 ms.
- **`nuqs`**, with every parameter defined once in `apps/lms/lib/search-params.ts`.
- **Sticky site header**, `max-w-7xl` for the data-dense shell, one action in the company header.
- **Distributions** for ratings and interview difficulty, replacing prose where a shape reads faster.

## Shallow or not, and why

Founder decision: `useQueryState` for both, with `shallow` deciding whether the server is involved.

- **Tabs and directory filters are `shallow: false`.** The server owns the panel and the list. This is also what keeps the page indexable — verified by fetching each tab and grepping the HTML, not by looking at a browser:

  ```
  ?tab=reviews  → review prose present
  ?tab=pay      → pay figures present
  (default)     → overview present
  ```

- **Within-panel filters are `shallow: true`.** Every review and interview is already on the page, so filtering is a local array operation; a round trip would fetch data the browser is holding.

## Bundle cost, measured

The directory used to say in its own comment that filters were a plain GET form with no client JavaScript, deliberately, for the budget. That is no longer true, so it was measured on a production server rather than assumed:

```
/companies            199.8 KB gz  (target 250, ceiling 300)
/companies/arbisoft   206.4 KB gz  (target 250, ceiling 300)
/courses              192.0 KB gz
```

Roughly 8–16 KB for the island. Inside budget with room; the comment in `check-bundle-budget.ts` now records the real numbers.

## Judgement calls

- **Distributions are withheld below five rows**, the same rule as the sub-scores. Five bars drawn from two reviews is a picture of nothing — the visualization guidance's own "sometimes the answer is not a chart". Below the threshold Overview shows a "Latest review" / "Latest interview" preview instead, so it is never an empty panel.
- **One hue, not one per bar.** The bins are ordered levels of a single measure, not separate identities; colouring them differently would imply a distinction that is not there. One series, so no legend — the title names it — and every bin is directly labelled, which removes the need for a hover layer. A screen-reader table accompanies each figure.
- **Header reduced to one action.** Claiming moved into About as a sentence, Careers next to the website. Three buttons in three variants and three widths read as three competing affordances, and only "Share your experience" is aimed at the people who actually read this page.
- **No location filter**, deliberately. `reviewPublicColumns` and `interviewPublicColumns` do not carry a city, by design — F2.3a and N2.2 anonymise contributions, and adding a city to filter on would widen what a public payload says about an author. Location filtering exists where location is already public: the pay breakdown.
- **Independent scroll panes were not built.** A sticky header and a sticky tab bar give the fixed frame; two independently scrolling columns on a public, indexable page would break find-in-page and need a separate mobile layout. Recorded here so the decision is not silently re-litigated.

## Found while doing it

**Props given to the island are in the RSC payload whether or not their tab renders.** The Overview panel shows a preview, but every review's full text is serialised into the page because the island receives them all. It is harmless today — this is public content — and it is exactly the trap part B has to design around: the gate cannot be "render a different panel", it has to be "do not fetch, and do not pass".

---

# Part B — the gate

## The shape of the fix

The gate is not a component. It is two calls at two levels, and the page-level
one exists only because of the RSC payload finding recorded above:

- `requireBankAccess` at the top of `companies.reviews`, `interviews`,
  `salaries` and `responses`, so the boundary holds against `curl` and not only
  against the UI.
- `companies.eligibility` asked by the page **before** it fetches anything
  gated. A page that fetched first and rendered a wall second would still ship
  every review in its payload, which is the whole trap. The procedure returns a
  verdict and nothing else, and a verdict is a fact about the viewer that the
  viewer already knows.

`GateWall` is then free of secrets by construction: every string in it is
written in `gate-wall.tsx`. The blur is decoration that says "there is
something here"; what hides the content is that the content was never read.

## Asserted on the response body

Signed out, against the seeded company that has two published reviews:

```
$ curl -s http://localhost:3001/companies/arbisoft > anon.html   # 78,193 bytes
"I learned React properly"              → 0 occurrences
"Real mentorship on the first project"  → 0 occurrences
"Sign in to read what people say"       → present
```

So the reviews are absent from the HTML and from the RSC payload embedded in
it, not merely invisible.

## Tests

`packages/api/src/gate.test.ts`, 20 cases against real Postgres: every gated
procedure × (signed out → `UNAUTHORIZED`, unverified → `FORBIDDEN`, admin →
allowed), the member exemption (D4), the facts tier still public (D1), the cold
bank (D2), a pending contribution counting and a 400-day-old one not (D3), and
the error carrying a reason a client can branch on.

`WARM_AT` is a parameter with a default rather than a constant read from the
module, purely so a test can pass `0` and exercise the contribution rule
without seeding 250 published rows. No caller in the product passes it.

## Found while doing it

- **The gate changed what "public" means for 26 existing tests.** Five suites
  read `companies.reviews` / `salaries` / `responses` as a signed-out caller,
  because until now that was the product. Each now reads as a verified reader,
  and the `bySlug` / `list` reads were deliberately left signed-out — that is
  the D1 facts tier, and those assertions are now the regression test for it.
- **`exists(… union all …)` with bound parameters failed** under postgres-js
  with `ERR_INVALID_ARG_TYPE`, not a SQL error. Rewritten as three
  `findFirst`s run together — one index seek each against the 0021 indexes, and
  legible besides.
- **`Eligibility` as a procedure's return type broke the app's type-check**
  with TS2883: the LMS infers the whole router through `useTRPC`, and it cannot
  name a type from a module it has no import path to. The verdict is written
  structurally in the router for that reason.

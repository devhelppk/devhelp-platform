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

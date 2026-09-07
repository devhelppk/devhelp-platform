# S13 test record

Date: 2026-09-07. Local Postgres 17, Mailpit, and MinIO from `docker-compose.yml`; dev server `pnpm dev`; migration `0019_company_claims` applied on top of S11.

## Automated

| Suite                  | Tests     | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/api` (Postgres) | 114 (+16) | a work email at the company's own domain matches, including a subdomain and a `www.` prefix, and a free mail provider, a different company, and a **lookalike suffix** (`evilacme.com` against `acme.com`) do not; a company with no website records the evidence rather than refusing; a claim reaches the queue with no track; approving makes the claimant an organisation member with role `owner`; rejecting leaves membership untouched and the person may claim again; somebody who already represents the company is refused; only a member may reply, and a signed-out visitor cannot; a reply is invisible until approved, then renders with its Markdown as HTML and nothing identifying its author; an admin-hidden reply is never republished by rewriting it; a member of one company cannot reply to another company's posts; the inbox is closed to non-members; approval grants `member`, never `owner`; hiding an approved claim removes the membership and closes the inbox; a moderator's queue payload always matches the text that would publish; a hidden reply's body is frozen, not only its status |
| Repo pipeline          | all       | `format:check && lint && check-types && test && build` clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

The lookalike-suffix case is the one worth naming: `emailDomain.endsWith(companyDomain)` would have let `evilacme.com` claim `acme.com`. The check compares against `"." + companyDomain`, and the test says so.

## The whole flow, in the browser

Driven with Playwright as two people — a representative on `rep@arbisoft.com`, and an admin:

| Step                                    | Result                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| Representative requests access          | Sent; the confirmation says the domain matched           |
| Manage page before approval             | Not available                                            |
| Admin approves the claim from the queue | Membership created                                       |
| Manage page after approval              | 200, showing every review and interview with a reply box |
| Reply written, Markdown included        | Held, shown as "Waiting for review"                      |
| Public company page before approval     | No reply visible                                         |
| Admin approves the reply                | Decision recorded                                        |
| Public company page after approval      | Reply under the review it answers, Markdown rendered     |

## Browser loop (Chrome, dev server)

Five routes in light and dark at 1440 px and 390 px, with console errors, page errors, HTTP status, and horizontal overflow asserted on all 20 combinations. Each route is visited as the identity meant to see it.

Round 1 found:

- **Two console errors that were the harness, not the product.** The loop hit `/moderate` with the representative's session, which correctly 404s, and Next's development 404 page emits a failed-resource error and a React script-tag warning. Confirmed by visiting every product route on its own: all clean. The loop now carries an identity per route.
- The database had been rebuilt for the S11 CI check, so Arbisoft had no published reviews and the manage page had nothing to reply to. Fixtures re-seeded; not a product problem, but it is why the first flow run stopped early.

Round 2: clean on all 20 combinations. Found by looking rather than by assertion: the manage page showed a stored reply as raw Markdown (`**Promotion criteria**`) because it rendered the source. It now renders the same HTML a reader sees, and the edit form keeps the source.

Round 3: clean on all 20 combinations. Screenshots in `screenshots/` are from this round.

## After the code review

Four high findings, three of them the same shape — a door opened without enough thought about what was behind it. The tests above grew by three to cover them: that approval grants `member` rather than `owner`, that hiding an approved claim actually takes representation back, and that a hidden reply cannot have its text swapped behind its status. See `review.md`.

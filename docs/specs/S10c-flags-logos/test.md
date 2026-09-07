# S10c test record

Date: 2026-09-07. Local Postgres 17, Mailpit, and MinIO from `docker-compose.yml`; dev server `pnpm dev`; migrations `0015_salary_reports` and `0016_company_favicons` applied on top of S10b.

## Automated

| Suite                  | Tests    | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@repo/api` (Postgres) | 80 (+8)  | flagging a company review stores the reason the reader chose, not a default, and upholding it hides the review and drops it from the page; the same for an interview experience; upholding a flag hides a salary point whose moderation item is still pending, which the old "only when approved" rule could not do; a second flag from the same reader is reported as a duplicate rather than refused, and only one row exists; a salary report names its role and lands as a track-less, admin-only item; reporting a role with no published figures is refused; a second reporter on the same company succeeds with one item and two flags, and the same person twice is a duplicate; a decided report reopens when somebody reports again                                                                                                                                                                                                                                                                                  |
| `lms` (jsdom)          | 29 (+27) | the four upload types are accepted and everything else refused, by type, by an empty file, and at one byte over the 256 KB limit; initials take up to two letters, ignore punctuation, and never render empty; `isSafeIconUrl` allows a public http(s) site and refuses localhost, every private IPv4 range, IPv6 loopback and link-local, the cloud metadata address, `file:`, `gopher:`, and junk; `pickIconUrl` prefers a declared icon over the conventional path, the largest declared size, and an apple-touch-icon, resolves relative hrefs, and keeps an absolute one; `isPublicAddress` refuses every private, loopback, link-local, carrier-grade-NAT, multicast, and IPv4-mapped-private address; ordinary domains starting "fc"/"fd" are allowed; SVG is not a fetchable icon type; `walkRedirects` refuses a public URL that redirects to the metadata address before making the second request, refuses a name resolving to a private address or to a mix, caps a redirect loop, and refuses a non-http redirect |
| Repo pipeline          | all      | `format:check && lint && check-types && test && build` clean; `pnpm check-budget` against `next start`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Bundle budget

The flag and report controls are the first interactive things on the company page. They go through server actions rather than the tRPC client, so the page does not gain the tRPC provider or React Query:

| Page                  | Before | After    |
| --------------------- | ------ | -------- |
| `/companies`          | 192 KB | 192 KB   |
| `/companies/arbisoft` | 192 KB | 193.4 KB |

1.4 KB for three interactive controls. Going through `useTRPC` instead would have pulled the whole client in.

## The mark, end to end

Checked against the running server, watching the fallback chain in order:

| State                     | Served                                              |
| ------------------------- | --------------------------------------------------- |
| Logo uploaded by an admin | The uploaded PNG                                    |
| Logo removed, website set | `arbisoft.com`'s own icon, fetched and cached in R2 |
| Website cleared too       | A generated monogram SVG reading "A"                |

The second row is the one the founder asked for mid-spec: the icon is fetched server-side and stored in our bucket, so a reader's browser never talks to the company's site or to a third-party favicon service. `favicon_checked_at` is stamped before the fetch, so concurrent requests do not stampede, and a site with no usable icon is not retried for a month.

## Browser loop (Chrome, dev server)

The standard pass over eight routes in light and dark at 1440 px and 390 px, with console errors, page errors, HTTP status, and horizontal overflow asserted on all 32 combinations, plus a scripted run of the new flows: upload a logo, serve it, refuse a text file, flag a review with a chosen reason, and report a role's salary figures.

Round 1 found:

- **"Reports" the column and "Report" the action sat next to each other** in the pay table and read as one thing. The column is now "Based on", and the count reads "10 reports".
- **A hydration warning in the console.** Chased it down: `caret-color: transparent` was being injected by Playwright's own screenshot, which hides the text caret by default. Running the same flow with `caret: "initial"` is clean, and nothing in the codebase sets that property. A harness artefact, not a product bug — but worth knowing, because it would have been easy to record as a real console error.

Round 2: clean on all 32 combinations, and all five scripted flows pass.

Round 3, after the favicon work: clean, with the real Arbisoft icon on the directory card and company page.

Round 4, after the code-review fixes: clean on all 32 combinations. The company page now reads the session once so a signed-out reader sees "Sign in to report" rather than a form that cannot work.

## Checked by hand

- The wrong file type is refused with the message a person would need ("Use a PNG, JPEG, WebP, or SVG image"), and the upload form says what happens without one.
- Replacing a logo deletes the previous object rather than leaving it in the bucket.
- **Listing the bucket found a leak the tests did not.** A fetched favicon was stored and the row repointed, but the object it replaced was never deleted, so every monthly re-check would have left another copy behind for ever. Fixed, then proved by clearing the bucket, forcing three consecutive re-fetches, and listing it again: one object.
- A company whose moderation item is still pending still gets a mark in the admin editor; the route serves any company row, because a mark reveals nothing that knowing the uuid does not already.

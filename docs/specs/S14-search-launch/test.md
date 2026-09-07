# S14 test record

Date: 2026-09-07. Local Postgres 17, Mailpit, and MinIO from `docker-compose.yml`; migration `0020_search_vectors` applied on top of S13.

## Automated

| Suite                  | Tests    | Covers                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/api` (Postgres) | 119 (+5) | one query finds a course, a lesson, and a company; an unpublished course, an archived lesson, and a pending company are never returned; a title match ranks above a body-only match; a query matching nothing returns empty rather than erroring; punctuation a person actually types (`"quoted"`, `or`, a leading `-`) is handled, which `plainto_tsquery` would have thrown on |
| Repo pipeline          | all      | `format:check && lint && check-types && test && build` clean                                                                                                                                                                                                                                                                                                                     |

## The fresh clone, timed

X9 asks for clone-to-running in under ten minutes following the README only. Done for real: a clone into a temporary directory, its own Docker stack, its own database, and only the commands the README lists.

| Step                    | Time          |
| ----------------------- | ------------- |
| `git clone`             | 1 s           |
| `pnpm install`          | 2 m 32 s      |
| `pnpm db:up`            | 8 s           |
| `pnpm db:migrate`       | 3 s           |
| `pnpm content:refresh`  | 6 s           |
| `pnpm db:seed`          | 3 s           |
| `pnpm dev` to first 200 | 12 s          |
| **Total**               | **≈ 3 m 5 s** |

Then checked that it actually works rather than merely starts: the catalogue lists both courses with titles, `/companies` and a company page render, search returns results, and Mailpit answers on 8025. No paid keys, no accounts, no third-party service.

**The run found a real error in the README.** Its quick start ran `db:seed` _before_ `content:refresh`, which since S11 produces an empty catalogue — the seed describes whatever content is already there, and there was none. The order is corrected and the reason is written next to it. This is exactly what the criterion is for, and it would not have been found by reading.

## Lighthouse, mobile

Against a production build (`next start`), throttled mobile, three runs each.

| Page                  | Performance | Accessibility | Best practices | SEO | CLS |
| --------------------- | ----------- | ------------- | -------------- | --- | --- |
| `/courses`            | 90          | 100           | 100            | 100 | 0   |
| `/companies/arbisoft` | 90          | 100           | 100            | 100 | 0   |
| A lesson page         | 88, 90, 88  | 100           | 100            | 100 | 0   |

**The lesson page does not reliably meet the ≥ 90 criterion.** It sits at 88–90 across runs. Everything else on it is excellent — first contentful paint 0.9 s, total blocking time 20 ms, speed index 0.9 s, no layout shift — and the score is held down entirely by Lighthouse's _simulated_ largest contentful paint of 3.6–3.9 s. Measured directly with a real 4× CPU and 1.6 Mbps throttle, the observed LCP on that page is **872 ms**, on a paragraph of body text.

So the number is Lighthouse's model of the route's 230 KB of JavaScript, not something a reader waits for. I tried the obvious lever anyway — loading the assessment harness and the video player through `next/dynamic` so an article lesson would not bundle them — and it did not work: the route stayed at 230 KB with the same script count, and the change was reverted rather than kept as indirection that buys nothing. Recorded as not met, with the measurements, rather than argued away.

## Bundle budget

Unchanged; the search page is server-rendered and ships no client JavaScript.

| Page                  | First-load JS (gz) |
| --------------------- | ------------------ |
| `/courses`            | 192 KB             |
| `/companies`          | 192 KB             |
| `/companies/arbisoft` | 193.5 KB           |
| A lesson page         | 230 KB             |

## Browser loop (Chrome, dev server)

Three states of the search page — no query, results, and no matches — in light and dark at 1440 px and 390 px, with console errors, page errors, HTTP status, and horizontal overflow asserted on all 12 combinations.

Round 1: a 500 on every search. Not the code: the fresh-clone experiment had left its own `next start` holding port 3001, serving the clone's build against the database I had just torn down, and my own `docker compose up` had then come back without its port bindings. Both cleared, and the loop re-run.

Round 2: clean on all 12 combinations. Screenshots in `screenshots/`.

## Known cosmetic effect of the S11 decision

A freshly seeded database titles courses from their slugs, so the catalogue reads "Ai engineering foundations" with a summary saying it was "written by nobody". That is the clean cut working as designed — titles live in the database and a mentor writes them in the studio — but it is the first thing a newcomer sees. Worth a nicer placeholder if the fresh-clone experience ever matters more than it does now.

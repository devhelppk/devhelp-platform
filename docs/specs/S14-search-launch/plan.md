# S14. Search, and getting to a launch

Scope: X3 (search), X8 (performance), X9 (open source and a fresh-clone run-through), plus the security review. **X6, analytics, is deferred post-MVP** (founder, 2026-09-07).

This is the last spec before the platform is something a stranger can clone, run, and read. Most of it is not new features; it is making true the claims the repository already makes about itself.

## Decisions

One settled with the founder on 2026-09-07: analytics waits. X9 requires the platform to run end to end on a laptop with no paid keys, and a self-hosted analytics service is another thing to run, back up, and patch before there is anyone to measure.

## Search (X3)

Postgres full-text, no new infrastructure — the company bank already proves the shape works.

- Generated `search_vector` columns on `courses` and `lessons`, weighted so a title outranks a body excerpt, with GIN indexes. Lesson bodies are not in Postgres (they compile from the content repo), so a lesson's vector covers its title and its course's title; searching prose is a later spec if it is ever wanted.
- One `search.query` procedure returning courses, lessons, and companies in one call, each with a matched snippet. Only published rows, and companies only where `status = 'published'`.
- `/search?q=` — a server-rendered page, no client island, so it costs nothing in the bundle and is linkable.
- The header gets a search entry.

Ranking is `ts_rank_cd` within a type and a fixed order between types (courses, then lessons, then companies), because a relevance score is not comparable across tables and pretending otherwise reads as random.

## Performance (X8)

- Measure first: Lighthouse mobile on the catalogue, a lesson, and a company page, recorded in `test.md` before and after.
- The budget script already guards first-load JS. This adds what it does not see: image sizing, font loading, and any layout shift.
- Fix what the numbers actually show rather than guessing; anything not fixed is written down with why.

## Open source and the fresh clone (X9)

- `LICENSE` (MIT for code), and a note that content is CC BY-SA and lives in the other repo.
- `CONTRIBUTING.md`: how to run it, what the checks are, how content differs from code, and the S11 rule about where metadata lives.
- `SECURITY.md`: how to report something privately.
- `README.md` rewritten as a fresh-clone path, then **actually followed on a clean clone** with a timer, and corrected wherever it lies. The acceptance criterion is ten minutes, and the only way to know is to do it.
- No paid keys anywhere in that path: Postgres, Mailpit, and MinIO all come from `docker compose`, `EMAIL_PROVIDER=log` needs nothing, and the salary conversion degrades to "no conversion" without an exchange-rate fetch.

## Security review

`/security-review` over auth, moderation, and the public surfaces, with findings recorded and fixed in `review.md`. Particular attention to what previous reviews have already caught twice: server-side fetches of user-supplied URLs, anything that renders user prose, and the boundaries where a role gate is read from a session rather than the database.

## Tests

1. `@repo/api` (Postgres): search finds a course by title and a company by name; an unpublished course, a pending company, and an archived lesson are never returned; a query that matches nothing returns empty rather than erroring; ranking puts a title match above a body match.
2. Browser loop: the search page with results and with none, in both themes at both widths.
3. By hand, recorded: Lighthouse numbers, and the fresh-clone run with its timings.

## Out of scope

Analytics (deferred), search over comments and reviews, a search-as-you-type client, and moving to Typesense or Meilisearch — the requirement says start with Postgres and move only if needed, and there is no traffic yet to say.

## Acceptance criteria

- [ ] Search returns courses, lessons, and companies for a plain query, and never returns something unpublished.
- [ ] Fresh clone to running app in under ten minutes following the README only, timed and recorded.
- [ ] Lighthouse mobile ≥ 90 on catalogue, lesson, and company page, recorded before and after.
- [ ] `/security-review` findings addressed or written down with a reason.
- [ ] MIT licence, contribution guide, and security policy present and accurate.
- [ ] Browser loop passed, at least two fix-and-reload iterations recorded in `test.md`.

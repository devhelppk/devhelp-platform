# S11 test record

Date: 2026-09-07. Local Postgres 17, Mailpit, and MinIO from `docker-compose.yml`; dev server `pnpm dev`; migration `0017_content_metadata` applied on top of S10c. Content is the sibling checkout of `devhelp-content` at `6bf0e95`, the commit that strips metadata.

## Automated

| Suite                      | Tests    | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/content` (Postgres) | 11 (+2)  | **a sync leaves studio-owned metadata alone**: a mentor's title, summary, level, and publish state on a course, and a title and duration on a lesson, all survive a sync that genuinely changes that lesson's content (the hash moves, the words do not); a brand-new course arrives `needs_metadata`, unpublished, with its slug as a placeholder                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `@repo/api` (Postgres)     | 97 (+17) | publishing is refused while a course is still the sync's placeholder, and allowed once it has a title and summary; `needsMetadata` clears when it is described; the edit trail records field, before, and after, with the actor; nothing is recorded when nothing changed; lessons and modules edit; learners and signed-out visitors are refused; a credit resolves to a user and renders as a byline; a credit for somebody without an account is refused; replacing one role leaves the other alone; the contributors list groups by person; a credit change appears in the trail; the overview surfaces a lesson readers tagged unclear; a summary counts as having described a course even when the title still matches the slug; a description longer than a trail entry saves without rolling the whole edit back; crediting the same person twice is one credit |
| `@repo/content-schema`     | 9        | unchanged, minus the test for `updated` (see below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Repo pipeline              | all      | `format:check && lint && check-types && test && build` clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

One test was retired rather than rewritten: `keeps an unquoted YAML date in frontmatter as a string` guarded a real gotcha — the YAML parser turning `2026-09-01` into a `Date` — but `updated` was the only date field in frontmatter and it has moved to the database. The comment in its place says to re-add it if a date field ever returns.

## The cut, checked by hand

| Step                                                               | Result                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `content:check` against the stripped repo                          | 2 courses, 1 path, 0 errors                                                                                   |
| A stray `title:` put back in `course.yaml`                         | `[moved-field] "title" is no longer part of the content repo; it now lives in the studio: edit it at /studio` |
| `content:sync` over the stripped repo                              | Titles, summaries, and publish state unchanged                                                                |
| A lesson title edited in the studio, then `content:sync` run again | The edit stands; the lesson page shows it                                                                     |

The last row is the acceptance criterion that matters, and it was checked against the real content rather than a fixture.

## The studio, end to end in the browser

Driven with Playwright as a signed-in admin:

| Step                                                       | Result                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| Lesson title and duration edited at `/studio/lessons/<id>` | Saved                                                       |
| Somebody credited as an author                             | Credited, with a search that only offers devhelp accounts   |
| Page reloaded                                              | The trail shows both the title change and the credit change |
| The public lesson page                                     | New title in the heading, byline underneath                 |
| `/contributors`                                            | Lists the person and what they worked on                    |

## Browser loop (Chrome, dev server)

Six routes — the studio overview, both metadata forms, contributors, a lesson, and the catalogue — in light and dark at 1440 px and 390 px, with console errors, page errors, HTTP status, and horizontal overflow asserted on all 24 combinations.

Round 1 found:

- **The studio screenshotted as a spinner.** Not a product bug: the loop waited a fixed 1200 ms, and these pages fetch on the client. The loop now waits for the loading state to clear and reports `[stuck loading]` if it never does — which is a better check than the fixed pause it replaces.
- **Nothing linked to the studio or to contributors.** A mentor would have had to know the URL. The studio is now in the account menu for mentors and admins; the contributors page is linked from the catalogue, where a signed-out reader can find it.
- **The dev database was full of test courses** from years of sync-test runs, which made the "waiting to be described" list meaningless. Cleaned; the sync tests create rows a later run leaves behind, which is worth knowing when reading that list locally.

Round 2: clean on all 24 combinations.

Round 3, after the account-menu and catalogue links: clean on all 24 combinations.

Round 4, after the code review added a path editor and made module titles editable: clean on 28 combinations (seven routes now).

Round 5, after trimming the overview's trail from twenty entries to ten: clean. Screenshots in `screenshots/` are from this round.

The dev database's `content_edits` were cleared of rows left by test users before the final screenshots. They show as "Someone" because `actor_id` is `on delete set null` and the suites delete their users — correct behaviour, meaningless in a picture.

## Found after pushing

Two things only a from-empty environment shows, and my dev database was not one:

- **A test leaned on state CI does not have.** `salaries.test.ts` seeded its own exchange rate — dated `2026-01-01`, which S10c's fourteen-day staleness rule then made invalid. It passed locally only because a real `fx:refresh` had left a fresher row in my database. CI caught it. The fixture is now dated today, and I proved it by emptying `fx_rates` before running.
- **A fresh sync leaves the catalogue empty.** That is the clean cut working as intended: a course arrives unpublished with its slug as a placeholder. But it means CI's bundle check hits three lesson pages that 404, and a developer who runs `pnpm db:seed` gets a site with no courses. `db:seed` now does what a mentor would do on their first visit — titles the synced content and publishes it — and refuses in production like the rest of the seed.

Both were verified by dropping the database, migrating, syncing, seeding, and running the whole pipeline the way CI does, before pushing again.

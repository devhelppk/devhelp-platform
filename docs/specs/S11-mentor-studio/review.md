# S11 review record

`/code-review high` reviewed the S11 work together with the seven unpushed S10 commits, and reported fifteen findings, four of them high. All were verified and fixed. Four were reproduced by the reviewer against the running stack before being reported, which made them quick to confirm.

Two of the four high findings are the same mistake in different clothes: **I moved a field out of the content repo without giving anyone a way to set it.**

## 1. The SSRF guard was bypassed by an address spelling (high)

`new URL()` normalises `http://[::ffff:169.254.169.254]/` to the hostname `[::ffff:a9fe:a9fe]` — the hex form. My IPv4-mapped check looked for the dotted spelling, so it never matched; `isIpLiteral` then skipped DNS validation because the host contains a colon, and execution fell through to `return true`. The cloud metadata endpoint, `[::ffff:127.0.0.1]`, and `[::ffff:10.0.0.5]` all passed. The test I had written passed only because it fed the dotted form, which production never produces.

This is the second time this guard has been wrong in two specs, both times because I checked a _spelling_ rather than an _address_. It now expands IPv6 properly — `::`-compression, trailing dotted quads, IPv4-mapped and IPv4-compatible ranges — and decides on the parsed groups. The tests feed the forms `new URL()` actually produces, and assert `new URL(u).hostname` is non-empty first, so a future normalisation change cannot make them vacuous.

## 2. Module titles became unfixable (high)

`module.yaml` lost its title, the sync seeds the slug, and module headings render on the course and lesson pages — but nothing in the UI called `studio.updateModule`. Its only caller was a test. The real content repo's `module.yaml` is already slug-only, so every module heading would have read as its slug with no way to change it through the product.

Module titles are now editable in place on the course form, with a "No title yet" badge while the title still equals the slug.

## 3. Paths became permanently undescribable (high)

The same mistake, worse: paths lost `title`, `summary`, and `published` from YAML, were seeded with the slug and an empty summary and `isPublished: false`, and had no router mutation, no studio page, and no `needs_metadata` column. A new path would have been invisible and unfixable.

Paths now have `needs_metadata` (migration `0018_path_metadata`), `studio.path` / `studio.updatePath`, a page at `/studio/paths/[slug]`, and a section in the studio overview. They follow the course rule for publishing: a title and a summary first.

## 4. A long description rolled back the whole save (high)

`metadataChangesSchema` caps a trail entry at 2000 characters; `updateCourse` accepts a description of 4000. `recordEdit` parses inside the transaction, so a 2500-character description threw a ZodError, rolled back the save, and surfaced as an opaque 500 — losing the title and summary edited in the same submit.

The trail is for a person to read, not for replaying, so `diff` compares in full and stores a clipped head. A test saves 3500 characters and asserts both that the description landed and that the trail entry is within its cap.

## 5 to 15

| #   | Finding                                                                                                                                                                                                                  | Fix                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 5   | `setCredits` de-duplicated ids before comparing against the users found, so duplicates passed validation and then violated the unique index. The credits UI sends exactly that when you click somebody already credited. | Ids are de-duplicated before use; a test credits the same person twice and expects one row.                          |
| 6   | The byline published the name and handle of a user whose profile is private, and linked to `/u/<handle>`, which 404s for exactly those people.                                                                           | The link appears only when the profile is public. The name stays: a credit is attribution an editor chose.           |
| 7   | One moved field in a file suppressed the generic diagnostic for every other unrecognised key in the same issue, so a genuine typo alongside a moved field went unmentioned.                                              | Moved keys are explained and the rest are still reported.                                                            |
| 8   | The credits editor derived the next list from a prop that only refreshes after the mutation round-trips, so two quick removals re-inserted the first person.                                                             | The controls are disabled while a change is in flight.                                                               |
| 9   | Rejecting a company proposal left the organisation row holding the name in the unique index, so the next person to propose that employer was told it was "already in the bank" at a URL that 404s.                       | A rejected proposal deletes the organisation. Test: the name is free and can be proposed again.                      |
| 10  | `dedupeKey` came from the item id, but S10c made items reusable, and `notify` drops a repeated key for ever — so a second decision on a re-opened item told the author nothing.                                          | The key carries the decision time.                                                                                   |
| 11  | `reportSalaries` reopened a closed report before checking whether that reporter had already filed one, so one person could bounce it back into the queue ten times a day while being told it was a duplicate.            | The reporter is checked first; a repeat leaves the decision alone. Test included.                                    |
| 12  | Alias uniqueness is global, so an alias already owned by another company was silently dropped and the admin was told the save succeeded.                                                                                 | The conflict is reported by name. Test included.                                                                     |
| 13  | The logo route's id check accepted any 36 characters from the uuid alphabet, so "36 dashes" reached Postgres and returned a 500 with a stack trace.                                                                      | A real uuid pattern.                                                                                                 |
| 14  | The icon size limit was applied only after the body had been fully buffered.                                                                                                                                             | `content-length` is refused up front when declared; the post-read check remains for servers that do not declare one. |
| 15  | `requiredCount++` became unconditional when `isRequired` moved to the studio, so the check fired only for a course with no lessons while still saying "no required lessons".                                             | The message says what it now checks: a course with no lessons cannot be completed.                                   |

## Found while fixing, not by the review

**Publishing was gated on the title differing from the slug.** A mentor who legitimately keeps the slug's wording as the title — "welcome", say — would have been unable to publish, with a message telling them to add a title they had already written. The summary is the reliable signal that a person has been here, because the sync seeds it empty and never writes it again. A test keeps the slug as the title and expects publication to succeed.

## Notes

- The studio overview's "recent changes" showed "Someone" for most entries in the dev database. That is correct: `content_edits.actor_id` is `on delete set null`, and the test suites delete their users. It reads properly for real edits.
- The trail on the overview was trimmed from twenty entries to ten; twenty dominated the page.

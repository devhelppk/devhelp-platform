# S10c review record

`/code-review high` reported nine findings, three of them high. All were verified and fixed, and the three high ones each have a test that would have caught the original.

Two of the three came from the favicon feature the founder asked for mid-spec. Fetching a URL somebody else controls and serving the bytes back from our own origin is a bigger step than it looks, and I did not treat it as one first time.

## 1. A second salary report crashed (high)

`moderation_items` is unique on (subject type, subject id), and a salary report's subject is the company. So the first report on a company worked and every later one — a different reader, a different role, a different currency — hit a unique violation, aborted the transaction, and put a raw Postgres message in front of the reader. `propose` in the same file already catches `23505`, so the shape of the problem was one I had already met.

The fix is to use both tables as they were designed. One `salary_report` item is the standing task about a company's figures; each reporter is a `content_flags` row attached to it, which is also what stops one person filing the same thing twice. A report on an already-decided task reopens it. Tests: a second reporter succeeds and there is still exactly one item with two flags; the same person reporting twice is a duplicate, not a second flag; a rejected report reopens.

## 2. The SSRF guard did not guard (high)

`isSafeIconUrl` checked the URL it was given and then fetched with `redirect: "follow"`, so a company website that answered `302 Location: http://169.254.169.254/…` was followed straight to the cloud metadata service — and the icon fetch had the same hole, with its bytes stored and served back. Separately, only literal IPs were refused, so any public hostname resolving to `10.x` walked through. The function's own comment promised it "must never be talked into calling localhost, a cloud metadata endpoint, or a private address". It could be.

Redirects are now followed one hop at a time with every hop re-validated, hostnames are resolved and every returned address checked, and the walk is capped. The decision logic is `walkRedirects` in `lib/favicon.ts` with the fetching injected, so the bypass itself is a unit test rather than a claim: a public URL that redirects to the metadata address is refused _before_ the second request is made, a name resolving to a private address is never requested, and a name resolving to a mix of public and private is refused too.

What this still cannot close is DNS rebinding — Node's fetch resolves again on its own, so a name that answers differently between the check and the connection could slip through. Closing it needs a pinned-socket agent. The comment says so now instead of overclaiming, and the exposure is a blind request whose bytes are only ever served back as a non-executable image.

## 3. A fetched SVG was stored XSS (high)

`ICON_TYPES` accepted `image/svg+xml`, and an SVG can carry script. A company site under an attacker's control could plant one; it would be cached in our bucket and served from the LMS origin, where opening the URL directly would run it with the reader's cookies. The comment "SVG is allowed; it is served, never parsed" was true only of _our_ parsing.

SVG is out of the fetched types entirely — a test asserts it, since this is the kind of thing a later convenience would quietly add back. Admin-uploaded SVG stays, that being a different trust level, and every response from the route now carries `X-Content-Type-Options: nosniff` and a `default-src 'none'; sandbox` CSP, so nothing served there can execute whatever it is.

## 4 to 9

| #   | Finding                                                                                                                                                                                                                          | Fix                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 4   | Replacing a logo did not bust any cache. The comment claimed the timestamped key produced a new URL; the URL is `/api/company-logos/<org id>` and never changes, so a corrected logo stayed wrong for a day on a CDN.            | The mark URL carries `?v=<profile updatedAt>`, threaded from the queries that already read the profile.                              |
| 5   | Approving a salary report told the reporter "The figures you reported is published" — ungrammatical, and the opposite of what happened.                                                                                          | `salary_report` has its own verbs: "was acted on" / "was reviewed, and the figures stand".                                           |
| 6   | The IPv6 unique-local check ran against any hostname, so `fdic.gov`, `fcbarcelona.com`, and any company domain starting `fc` or `fd` were treated as private addresses — and stamped as checked, so not retried for a month.     | IPv6 rules apply only to IPv6 literals. A test names those four domains, because the failure was silent.                             |
| 7   | The upload action re-declared the type and size limits instead of calling `checkLogo`, the module extracted specifically so they could be tested. Nothing in production ran the tested code, and the copies had already drifted. | The action calls `checkLogo`.                                                                                                        |
| 8   | The report controls rendered for signed-out readers and always failed, showing a raw "Sign in to continue." with no link. The S6 discussion control gates on being signed in; the new ones had dropped that.                     | The page reads the session once; a signed-out reader gets a "Sign in to report" link instead of a form that cannot work.             |
| 9   | "Remove" cleared the uploaded logo but left the cached third-party icon, which the route then served — while the button's copy promised initials, and the button itself disappeared because `hasLogo` only looked at the logo.   | Remove clears both and stamps `faviconCheckedAt`, so it does not fetch straight back; the admin page counts either as having a mark. |

## Found while fixing, not by the review

**Listing the bucket found a leak.** A re-fetched favicon was stored and the row repointed, but the object it replaced was never deleted — so every monthly re-check would have left another copy behind for ever. The logo path already deleted its predecessor; the favicon path had been written separately and did not. Fixed, then proved by emptying the bucket, forcing three consecutive re-fetches, and listing it again: one object.

**A console error that was my own tooling.** The loop reported a React hydration mismatch on a textarea, `caret-color: transparent`. Playwright hides the text caret during screenshots by injecting exactly that. Re-running with `caret: "initial"` is clean, and nothing in the codebase sets the property. Recorded because it would have been easy to log as a product bug, and because the loop scripts now pass `caret: "initial"` by default.

## Not fixed, deliberately

- **A salary report's payload names one role, and a company has one task.** A second report about a different role overwrites the payload rather than accumulating a list. The flags carry each reporter's own note, so nothing a person wrote is lost, and an admin looking at a company's figures will look at all of them anyway. Worth revisiting only if reports become common enough that the distinction costs an admin time.

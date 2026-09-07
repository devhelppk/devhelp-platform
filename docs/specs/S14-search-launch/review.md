# S14 review record

## Security review

`/security-review` ran over the S13 and S14 changes. **No findings met the reporting bar** (confidence ≥ 8 of real exploitability). That is a better result than it sounds, because the S13 review a few hours earlier had found four high-severity problems in the same code — the security pass was checking whether those fixes actually held, and they do.

What was checked and found clean:

**Authorization.** `claims.request` and `claims.respond` are verified procedures; `inbox` and `mine` are protected. `inbox` and `respond` both call `isMember` server-side before returning or writing, and `mine` is scoped to the caller. `respond` re-checks that the target post is published _and_ belongs to that organisation, so a representative of one company cannot reply under another's posts despite the response table's global unique index. The `/manage` and `/claim` pages re-derive the gate through the router, so the client check is not the boundary.

**The membership role.** Approval inserts `role: "member"`, never `owner` — the S13 review's most serious finding. The reviewer confirmed Better Auth's `member` role carries no invite, update, or delete permission, and that `claims.ts` and `moderation.ts` are the only two consumers of a `members` row anywhere in the codebase.

**The moderation gate.** Responses insert as `pending` and reach `published` only through `applySubjectStatus`. The conflict clause freezes body, HTML, and status when a row is hidden or rejected, so an unhide cannot publish text nobody reviewed; otherwise it re-queues with a refreshed payload, so a moderator reads the same words approval will publish. Both were S13 review fixes, and both hold.

**Anonymity.** `responsePublicColumns` omits `authorId`, and `companies.responses` selects only that set. A representative's inbox uses the same public column sets a reader gets — no more. Claim payloads carry the email _domain_, never the address, and are admin-visible only.

**Injection.** Search uses Drizzle `sql` templates throughout (`websearch_to_tsquery('english', ${q})`, `ilike ${like}`), which parameterise; nothing concatenates into SQL. The `case when … else ${input.body} end` expressions added for the frozen-reply fix are parameterised the same way. Migrations 0019 and 0020 are static DDL over local columns.

**XSS.** The two new `dangerouslySetInnerHTML` uses render `bodyHtml` produced only by `renderMarkdown` at write time, which runs `sanitize-html` with an allow-list, `http/https/mailto` schemes, and discard mode. No path writes `body_html` from client-supplied HTML.

### Noted below the bar, not fixed

- **A subdomain of a company's host counts as a domain match.** `claimEvidence` accepts `eng.acme.com` against `acme.com`. Exploiting it means actually controlling DNS under the company's domain, and the check is advisory — an admin still decides — so this is left as it is, deliberately.
- **Search returns lesson titles for published courses regardless of enrolment.** Titles are already public in the course outline, so this exposes nothing new.

## Acceptance criteria not met

**Lighthouse mobile ≥ 90 on a lesson page.** It scores 88–90 across runs, so it does not reliably meet the criterion. The page's own numbers are excellent — FCP 0.9 s, TBT 20 ms, CLS 0, and a directly observed LCP of 872 ms under real 4× CPU and 1.6 Mbps throttling. What holds the score down is Lighthouse's _simulated_ LCP of 3.6–3.9 s, which is its model of the route's 230 KB of JavaScript rather than a wait any reader experiences.

I tried the obvious fix — loading the assessment harness and video player through `next/dynamic` so an article lesson would not bundle them — and it made no difference: the route stayed at 230 KB with the same script count, because Next bundles per route regardless of what renders. The change was reverted rather than kept as indirection that buys nothing. Getting this over 90 means genuinely reducing the lesson route's payload, which is a piece of work with its own shape, not a line to tweak here. Recorded as not met.

## Found while doing the work

**The README told a newcomer to do the wrong thing.** Its quick start ran `db:seed` before `content:refresh`, which since S11 leaves an empty catalogue: the seed describes whatever content is already present, and there was none. Only the timed fresh-clone run surfaced it — reading the file would not have. Corrected, with the reason written beside it.

**Two stray processes from my own experiments broke the search loop.** The fresh clone's `next start` kept port 3001 and served its build against a database I had just torn down, and the main Docker stack then came back without port bindings. Every search returned 500 until both were cleared. Worth recording because the first instinct was to look at the new code, and the new code was fine.

# S20. Company merge, one sidebar, and the review's loose ends

The list the platform review (`../S19-platform-review/review.md`) left open, taken
in one pass. Founder decisions, 2026-09-12: do the small fixes **and** F2.9 merge
**and** the S16 D3 reader port; on a merge, a contribution that cannot move stays
on the merged company; no bulk moderation action.

## Part 1 — F2.9: merge duplicate companies

The last unbuilt functional requirement. `moderation_status` has carried `merged`
and `moderation_action` has carried `merge` since S5, and nothing could reach
either: a duplicate company was a hand-written SQL job. `companies.propose`
dedupes on an exact `lower(name)` or alias, so duplicates arrive as name variants
("X Systems Ltd" against "X Systems Limited") and by the time anyone notices both
carry reviews.

### Schema — migration `0022_company_merge`

- `company_status` gains `merged`. The public read predicate is already
  `status = 'published'`, so a merged company leaves the directory, `bySlug` and
  search with no further change.
- `company_profiles.merged_into_id` — the redirect pointer, one lookup for the
  page.
- `company_merges` — `from`, `into`, `actor`, and a `moved` jsonb typed by
  `mergeCountsSchema`: per table, how many rows moved and how many stayed. Company
  fact edits record only `verified_at`/`verified_by`, which is enough for an edit
  and not for an action that moves everything written about an employer.

### The decisions inside `companies.merge`

- **The losing company is not deleted.** Deleting an organisation cascades away
  every review, interview and salary point about it — the same reason S13 refuses
  to grant `owner` on a claim. It becomes `merged` with a pointer, which keeps its
  slug resolving and holds what could not move.
- **What cannot move stays.** One review per author per company, one salary point,
  one membership. If the same person wrote about both companies, moving the row
  would violate that unique index. The `not exists` guard restates the index
  deliberately: letting Postgres raise 23505 aborts the whole transaction, and
  then there is nothing left to report. Those rows stay on the merged company,
  unreachable, rather than being deleted or given a moderation status by a
  decision no moderator made.
- **The old name becomes an alias of the winner**, so search still finds the
  employer under the name people know, and nobody can propose the duplicate back
  into existence.
- **A chain stays one hop.** Merging the winner on re-points everything that
  pointed at it, so the page never follows a pointer twice.
- **The confirmation is the losing company's name, typed.** A merge the wrong way
  round moves every review about the surviving company onto the duplicate and
  needs a second merge to undo.

### Surfaces

`/admin/companies` is a shadcn `Table` with the counts that justify acting and a
row action menu (Edit facts, Merge into…); the merge itself is a dialog with an
async company search. The company page redirects a merged slug with a 308.

## Part 2 — S16 D3: one sidebar system

The reader was the only caller of the hand-rolled `AppShell` + `SidebarNav` +
`MobileNav`. It is now on shadcn's `Sidebar` (`collapsible="offcanvas"`, because a
rail of lesson titles has no icon form), its `SidebarTrigger` replaces the
lazily-loaded mobile drawer, and those three components plus `LazyMobileNav` are
deleted. `packages/ui` has one sidebar system.

**Measured, because the reader is the signed-out SEO surface:** first-load JS went
**230.0 → 259.7 KB gz**, against a 250 KB target and a 300 KB ceiling. The plan's
gate was the ceiling, and it held, so the port stands — but +29.7 KB on the most
read page in the platform is the honest price of deleting a second shell, and it
is recorded here rather than discovered later. If it ever needs winning back, the
move is to render the reader's rail without the client provider for signed-out
visitors.

`/design`'s shell demo could not simply be re-pointed: shadcn's `Sidebar`
positions its rail `fixed inset-y-0 h-svh` against the viewport, so it cannot be
boxed inside the style guide's 36rem frame. The demo now shows the shell's
vocabulary — `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenuButton` with its
active state — and says that the assembled shell is every LMS page.

## Part 3 — the small gaps

1. **"0 min" on every course card.** The card guarded its lesson count with
   `> 0` and printed the duration unconditionally, so a course whose lesson
   durations are not entered yet read "0 min". Guarded the same way. This does not
   fill the metadata in — that is still the founder's studio task from the review.
2. **`sync.test.ts` leaked a course on every run.** It creates `${slug}-fresh` in
   Postgres and its teardown deleted only the exact slug, which is why the dev
   database held twenty `sync-*-fresh` courses dating to 2026-09-07. It deletes
   the row now.
3. **`pnpm db:clean-fixtures`** (`--yes` to apply) deletes fixtures left by a
   killed run. The other nineteen leftovers were all created inside three seconds
   on 2026-09-12 — one interrupted run, whose `afterAll` never got to run — and
   `createCourse` inserts with `isPublished: true`, so they were in the dev
   catalogue. Admins are excluded from the user sweep, because `dev:admin`'s
   default email is also `@devhelp.test` and deleting the account you are signed
   in as is a surprise nobody wants twice.
4. **X8's wording** claimed the company bank and catalogue were static-rendered
   with ISR. They are deliberately `force-dynamic`; the requirement now says so
   and says why.
5. **`COMPANY_BANK_WARM_AT`** (default 250) makes S15 D2's threshold
   configuration rather than a constant: the founder can turn the contribution
   half of the gate on or off without a deploy, and the `needs_contribution` wall
   becomes reachable in development, where the bank is always cold.
6. **The handle field clipped its own prefix at 390px** ("s:3001/u/"), found in
   the mobile pass. It wraps now.
7. **`pool.test.ts` failed at exactly its bound** under load ("expected 550 to be
   less than 550"). The bound is 580: a single connection cannot finish two 300 ms
   sleeps in under 600 ms, so 580 still proves the pool and leaves real slack.

## Acceptance criteria

- [x] Two companies with contributions merge: reviews, interviews, pay, replies,
      claims, representatives and aliases move; the collision stays behind; both
      halves are counted in `company_merges`.
- [x] The merged slug 308-redirects to the winner; the merged company is gone from
      the directory; its old name still finds the winner and can no longer be
      proposed.
- [x] A merge is admin-only and refuses itself, an already-merged end, and a
      mistyped confirmation.
- [x] `packages/ui` has one sidebar system, and the reader's cost is measured.
- [x] The seven S15 viewer states verified on a live server with real sessions.
- [x] A live 390px pass over the admin, moderation, studio and account pages.
- [x] `format`, `lint`, `check-types`, `test`, `build` green.

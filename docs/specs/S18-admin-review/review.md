# Admin pages: review and test

Driven in Chrome as an admin at 1440×900, dark. Actions were **performed**, not just looked at, against the seeded queue (1015 pending items).

## Functional defects

1. **The moderation queue could only ever show 30 of 1015 items.** The `queue` procedure has accepted a `cursor` and returned a `nextCursor` since S5; the client asked for one page and rendered it. There was no pagination control of any kind, so item 31 was unreachable. Now `useInfiniteQuery` over the same cursor with a Load more — verified 30 → 60 on the pending company reviews.

2. **Every queue row was unreadable.** Each read `<kind> by someone`, so a thousand pending items were indistinguishable and each had to be opened to learn anything. `moderation_items.payload` is a snapshot stored precisely so a decision can be re-read, and none of it was shown. Rows now carry a derived one-line summary per kind (`summary.ts`): "Payco 2df4695d · Frontend engineer · (Senior, Karachi)", "Acme 5f4a1aa4 · 5/5. Pros: … Cons: …".

3. **No way to filter by kind.** 800 of 1015 pending items were salary points, drowning 60 company reviews. The procedure already took `subjectType`; the UI never offered it. Now a kind filter in the URL (`?type=`).

4. **The badge picker on `/admin/badges` was an empty stub** — a regression from my own S16 select conversion. `FormSelect` passed a sentinel value for required fields with no empty choice; Radix then had a value matching no item, so it rendered a blank trigger _and_ no placeholder. Fixed by passing `undefined` in that case, and by defaulting the trigger to `w-full` (the design system's trigger is `w-fit`, which collapses to a chevron when nothing is selected).

5. **Reasons were recorded and never displayed.** `/admin/badges` says "the reason is kept on the award" and the API returns `awardReason` and `revokedReason`; the list showed neither. `/admin/certificates` likewise returned `revokedReason` and did not show it. Both now do.

6. **"Submitted by: Unknown (, student, joined ?)"** in the item detail. `author_id` is `on delete set null` and a contribution outlives its account, but the parenthetical rendered regardless, producing a string that reads like a bug rather than a deleted account. Now "No longer on the platform".

7. **Five pages had lost the wide measure** — `admin/badges`, `admin/certificates`, `admin/companies`, `moderate`, `studio` — because the S16 port matched `<Page wide callbackURL=` and dropped the prop. Every one is a list or a queue. Restored.

## What was tested, and passed

- **Approve a salary point.** Status → Approved, `moderation_actions` row written with `action=approve` and the actor, counts behind the dialog moved 1015 → 1014 pending and 246 → 247 approved without closing it.
- **Award a badge by hand.** `user_badges` row written with `award_reason` = the text entered and `awarded_by` set; the list shows it as "by Shahzaib" rather than "automatic".
- **Learner search.** `badges.searchLearners` (admin-only, capped, debounced) returns name + email matches; typing `mtxu1io8` found the one learner.
- **Role gating.** The sidebar's Admin group appears only for an admin, decided on the server.

## Interaction changes on founder direction

- **The item detail is a dialog on the queue**, opened by `?item=<id>` with `shallow: false`, so the server owns it and a refresh or shared link lands on the same item. `/moderate/<id>` still works for a direct link. The dialog wraps the existing `ModerationItem`, so the decide mutation and its cache invalidation are unchanged — which is why the queue behind it refreshes on a decision.
- **Rare and destructive forms moved into dialogs.** `/admin/badges` had an always-open award form pushing the awards below the fold, with a destructive Revoke submit beside the constructive Award. Awarding is now a header action; revoking is a row action that names the award it is about, so an admin cannot mistype their way into revoking the wrong one. `/admin/certificates` revoke/restore moved from a form that expanded inside the table to a dialog.
- **`PageHeader` everywhere.** The award button first landed _under_ the page header with the right half of the header empty. `DESIGN.md` already said "primary action to the right" — the admin pages had hand-rolled `<header><h1>` instead of using the component that does it. Nine pages converted, and the rule is now stated as a rule in `DESIGN.md` and `CLAUDE.md` rather than a description.

## Still open

- `/admin/certificates` has a search but no pagination; it loads 30. Same class as the queue defect, not yet fixed.
- `/admin/companies` and `/studio` were only looked at, not exercised.
- No 390px pass on any admin page.
- The queue has no bulk action. Approving 800 seeded salary points one at a time is not viable; whether that matters depends on whether real volume ever looks like this.

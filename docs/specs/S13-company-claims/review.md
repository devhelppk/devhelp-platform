# S13 review record

`/code-review high` reported seven findings, four of them high. All were verified and fixed. Three of the four are the same shape: **I gave representatives a door and did not think hard enough about what was behind it.**

## 1. An approved representative could delete the company (high)

The claim approval inserted the member with `role: "owner"`. Better Auth's organization plugin is mounted at `/api/auth/[...all]` with no custom access control, so the default `ownerAc` applies: `organization: ["update", "delete"]`, `member: ["create", "update", "delete"]`, `invitation: ["create", "cancel"]`.

An approved claimant could therefore call `/api/auth/organization/update` to rename the company or change its website, `/api/auth/organization/delete` to destroy the organisation row — which cascades away `company_profiles`, `company_reviews`, `interview_experiences`, and `salary_points`, every word anyone had written about them — or `/api/auth/organization/invite-member` to add accounts that then pass `isMember` and gain reply rights.

Nothing in S13 needs owner permissions. The role is `member`, and the reason is written where the insert is.

## 2. There was no way to take representation back (high)

Hiding or rejecting an approved claim set `company_claims.status` but left the `members` row, and nothing anywhere else deletes from `members`. A wrong approval — an impersonation, or somebody who has since left the company — was permanent: they kept the inbox and kept replying. Hiding a claim now deletes the membership in the same transaction, and a test walks approve, hide, and confirms the inbox closes.

## 3. A moderator could be shown different text from the one that publishes (high)

The response upsert refreshed the row's body but not the moderation item's payload, and the queue renders the payload. So: send a harmless reply, edit it to something else before an admin looks, the admin reads the harmless snapshot, approves — and the edit goes live. `contributions.ts` already refreshed its payload on re-submission; this was the deviation. Both the response and the claim payloads are now rewritten on re-submission, along with clearing the stale `reason` and `policyClause`.

## 4. A hidden reply's text could be changed behind its status (high)

The "never republish something an admin hid" rule was enforced on `status` alone, so an edit rewrote `body` and `bodyHtml` while the status stayed `hidden`. The row then held words nobody had reviewed, and an `unhide` — an allowed transition — would publish them. The existing test passed because it only asserted the status.

Hidden and rejected replies are now frozen in text as well as status, and the test asserts the body is unchanged.

## 5 to 7

| #   | Finding                                                                                                                                                                                               | Fix                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 5   | Re-requesting a rejected claim reset the item to pending without refreshing the payload, so an admin re-reviewed the old evidence and old message, with the previous rejection reason still attached. | The payload, reason, and policy clause are all refreshed.                                       |
| 6   | Decision notifications for a claim or a reply fell through to `/notifications` although both payloads carry a `companySlug`.                                                                          | Both link to the company.                                                                       |
| 7   | The manage page treated every `TRPCError` as a 404, so a database blip told a legitimate representative they had no access and hid the failure.                                                       | Only `NOT_FOUND` and `FORBIDDEN` are a 404; anything else throws, as on the sibling claim page. |

## Checked and clean, per the reviewer

Cross-company reply injection (the subject lookup filters on `organizationId` and `status`), the anonymity of all three public column sets, the `claimEvidence` suffix check, every `onConflict` target matching its unique index, the `ALTER TYPE … ADD VALUE` in the migration, and `dangerouslySetInnerHTML` being fed only by server-side `renderMarkdown`.

## A process note

This review ran against a commit that a stale background task had created while I was still working: it swept the in-progress S13 code into a commit labelled "Plan S13 and S14", along with a `docs/spec.md` that a bad scripted edit had blown up to 449,000 lines. Both were caught before pushing — the commit was unpushed, so the history was reset and rebuilt honestly. The lesson is in the tracker: scripted multi-line edits to `docs/spec.md` have now corrupted it twice, and line-indexed edits with assertions are the only ones that have held.

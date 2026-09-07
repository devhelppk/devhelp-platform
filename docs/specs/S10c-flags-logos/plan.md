# S10c. Company bank: flags and logos

The two gaps `S10a/review.md` recorded as "for later specs", plus one thing found while planning them. Small, but both are the kind of thing that is much cheaper before the bank has real traffic than after.

## Decisions

Two settled with the founder on 2026-09-07.

1. **Salary points are flaggable, not only reviews and interviews.** I raised a problem with this: the page never shows an individual salary, so a reader cannot point at the figure they doubt, and a flag would land on a whole role. The founder chose it anyway, so the faithful implementation is to make the target what the reader can actually see — the role row. A report says "the figures for Backend engineer at this company look wrong", and the admin, who can see every point, decides which ones to hide.

   That is a new moderation subject, `salary_report`, whose subject is the company and whose payload names the role and currency. It is an admin task rather than a piece of content: upholding it hides nothing by itself, because there is no single row it refers to.

2. **Company logos are uploaded by admins to R2.** `company_profiles.logo_key` and the `@repo/storage` driver have been waiting since S7. An admin uploads on the facts page; the file is validated, stored in R2, and served through a cached route, because the bucket is not public. This is work per company done by the founder, which they accepted, and it exercises the upload path that S13 needs anyway when a company claims its profile.

## Found while planning

**The existing flag button records the wrong reason.** S6's discussion flag hard-codes `reason: "off_topic"`, so a reader flagging a comment for naming an individual is logged as off-topic and the moderator reads the wrong thing. `flag_reason` has had six values all along. Since S10c builds a flag control anyway, it becomes a shared one with a reason picker, and the discussion uses it too.

**Upholding a flag cannot hide a salary point.** `resolveFlag` only hides when the item is `approved`, but a salary point publishes while its item is still `pending` (S10b). So a flag on the one contribution kind that is public before review is the one flag that cannot act. The rule becomes "hide when the subject is public", which covers both.

## Work

- `moderation_subject` gains `salary_report`; a payload schema names the company, role, and currency. Migration `0015_salary_reports`.
- A shared `FlagControl`: a button that opens a small reason picker, submits through `moderation.flag`, and reports back. Used on company reviews, interview experiences, salary role rows, and discussion comments.
- `resolveFlag` hides a subject that is already public even when its item is pending.
- Admin logo upload: a server action validating type (PNG, JPEG, WebP, SVG) and size (256 KB), writing through `@repo/storage` under `companies/<org id>/logo.<ext>`, setting `logo_key`. Served by `/api/company-logos/[file]`, cached, with the same shape as the certificate route. Shown on the directory cards and the company page, with the company's initials as the fallback where there is no logo.
- Tests: a flag on each company subject creates a flag row and reaches the queue; the reason submitted is the reason stored; upholding a flag on a published-but-pending salary point hides it; a salary report names its role; an upload rejects the wrong type and an oversized file, and sets `logo_key`.
- Browser loop: flagging from a company page, the reason picker, the report control, the logo upload and its fallback, in both themes at both widths.

## Out of scope

Company-side responses to a flag (S13), automatic action on flag volume, and image resizing or format conversion — an admin uploads something sensible or the upload is refused.

## Acceptance criteria

- [ ] A reader can flag a company review, an interview experience, and a role's salary figures, choosing a reason that is what gets stored.
- [ ] Upholding a flag hides the subject, including a salary point whose item is still pending.
- [ ] A logo round-trips through R2 and appears on the directory and the company page; companies without one show initials, never a broken image.
- [ ] Uploads refuse anything but a small image.
- [ ] Browser loop passed, at least two fix-and-reload iterations recorded in `test.md`.

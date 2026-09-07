# Security

## Reporting something

Email **security@devhelp.pk** with what you found and how to reproduce it.
Please do not open a public issue for anything that could be exploited before
it is fixed.

You will get a reply within three working days. If the report is valid you will
hear what the fix is and when it ships, and you will be credited unless you
would rather not be.

## What is in scope

This repository (the platform) and `devhelppk/devhelp-content` (the
curriculum). Especially welcome:

- Anything that lets one person read or change another's data.
- Anything that bypasses moderation: publishing without review, editing
  something after approval, or making a decided item act as if undecided.
- Anything that de-anonymises a contributor. Company reviews, interview
  experiences, and salary points are anonymous by design and the author id is
  never in a public payload; a way to work backwards from published data to a
  person is a serious bug.
- Server-side request forgery through any URL a user supplies. Company websites
  are fetched to find a logo; that path has been wrong twice already.
- Anything that renders unsanitised user prose.

## What is out of scope

Findings from an automated scanner with no demonstrated impact, missing headers
with no exploit, rate-limit tuning, and anything requiring a compromised
developer machine or a stolen session cookie.

## What we already know

Open items are tracked in `docs/spec.md`. The known residual risk in the logo
fetcher — DNS rebinding between the address check and the connection — is
documented in `apps/lms/app/api/company-logos/[file]/route.ts`.

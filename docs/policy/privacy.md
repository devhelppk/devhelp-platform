# Privacy

Last updated: 12 September 2026. Questions or requests: policy@devhelp.pk.

devhelp.pk is a free, open-source learning platform. This page says what we store, why, who else can see it, and how to get rid of it. It is written to be read, not to be survived.

The short version: we store what the platform needs to teach you and to publish what you choose to publish. We do not sell anything, we run no advertising, and we have no third-party trackers or analytics on any page.

## What we store

- **Your account.** Your name, your email address, and either a password hash or the fact that you signed in with GitHub or Google. If you sign in with GitHub or Google we receive your name, email address and avatar URL from them, and nothing else.
- **What you learn.** Which courses you enrolled in, which lessons you completed and when, quiz attempts and scores, exercise submissions including the code you wrote, your streak, and the badges and certificates you have earned. This is the platform working; without it "continue where you left off" cannot exist.
- **What you contribute.** Company reviews, interview experiences, pay data points, replies, comments, questions, ratings and flags. Contributions are stored with your account id so that we can enforce one review per company per person, so a moderator can act on a pattern, and so you can edit your own. See "Anonymity" below for what other people see.
- **Your profile, if you make one public.** A handle, a short bio, a city, and links you enter yourself. This is off by default.
- **Operational records.** Moderation decisions and the reasons for them, rate-limit counters, notification records, and content edit history for mentors. Server logs contain IP addresses and are kept by our hosting provider.

We do not ask for and do not want: your CNIC or any government identifier, your date of birth, your phone number, your address, or your current salary tied to your name.

## Anonymity of contributions

A company review, interview experience or pay point is published **without your name, your handle, or your account id**. The public payload never includes them: the queries that build those pages select an explicit list of columns that excludes the author, and dates are rounded to the month. Pay figures are published only as aggregates, with a minimum of five reports per role and rounding applied, so that no single person's pay can be read off the page.

Your identity stays linked to your contribution internally, for moderation and for the one-per-person rules. The devhelp team and moderators can see it. Nobody else can, including the company you wrote about.

## What we send you

- **Transactional email only**: verifying your email address, resetting your password, and organisation invitations. These go through [Resend](https://resend.com), which processes them on our behalf.
- **No notification emails.** Badges, replies and certificates are announced inside the app and are not emailed. There is no newsletter and no marketing email.

## Who else processes your data

- **Resend** — transactional email delivery.
- **Cloudflare R2** — object storage for certificate PDFs, company logos and uploaded images.
- **Our hosting provider and database host** — running the application and storing the database.
- **GitHub or Google** — only if you choose to sign in with them.

There are no analytics services, no advertising networks, no session recording, and no social media pixels. If that ever changes, this page changes first and says which service and why.

## Cookies

A session cookie so you stay signed in, and a small preference cookie for whether the navigation rail is collapsed and whether you chose light or dark mode. No tracking cookies, and therefore no cookie banner to click through.

## What is public

Your certificates have a public verification page, which is the point of them — anyone with the link sees the course, the date, and the criteria you met. Your profile is private until you make it public. Your contributions are public but anonymous. Your progress, your quiz scores and your exercise code are never public.

## Getting your data out, or deleting it

Write to policy@devhelp.pk and we will export your data or delete your account. Deleting your account removes your name, email and profile, and detaches your contributions from you, leaving them published and anonymous — which is the state they were already in from every reader's point of view. Issued certificates are not deleted, because a verification link that silently stops working is worse for you than one that keeps working; tell us if you want yours revoked.

**Open decisions, to be settled before launch:** how long server logs are kept, whether account deletion becomes self-service in the app rather than by email, and whether we set a minimum age for an account.

## Children

The platform is built for university students and working engineers. We do not knowingly create accounts for children under 13.

## Changes

This page lives in the platform's public repository, so every change to it is a commit anyone can read. Material changes will be announced in the app.

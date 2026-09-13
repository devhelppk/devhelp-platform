# Roadmap

Last updated: 12 September 2026.

devhelp is built in public. This is what works today, what is being built, and what has been deliberately put off. The engineering tracker behind it is [`docs/spec.md`](https://github.com/devhelppk/devhelp-platform/blob/main/docs/spec.md) in the platform repository, which carries the detail and the reasoning.

## Working now

- **Courses and lessons.** A catalogue by track and level, lessons that read on a phone, and progress that resumes where you stopped. Any lesson can be read without an account.
- **Quizzes and exercises.** Quizzes are graded on the server, so answers are never in the page. Exercises run in your browser against the tests that ship with them — JavaScript and TypeScript.
- **Certificates.** Finish a course and you get a certificate with a public verification page and a PDF, showing which criteria you met and when.
- **Badges and streaks**, computed in Pakistan time from what you actually did.
- **The company bank.** Reviews, interview experiences and pay for software employers in Pakistan, written by the people who worked there and published anonymously after review. Pay is shown only as aggregates, with a floor of five reports per role.
- **Company replies.** A company representative can claim their profile and answer publicly. They cannot edit or remove a review.
- **Search** across courses, lessons and companies.
- **Ratings, reviews and discussion** on lessons and courses, with one level of replies.
- **A studio for mentors** to describe courses and lessons, and a moderation queue for everything a person submits.
- **The whole thing runs on a laptop.** Docker, Node, pnpm; no paid keys, no accounts to sign up for.

## Next

- **The curriculum.** The platform is further along than the content. The five-course launch set — core engineering, data structures, databases, the engineering flagship, and agentic AI in two halves — is being written, in the open, in the content repository.
- **Course metadata and credits** filled in for everything published, so the catalogue reads like a curriculum rather than a placeholder.
- **Cohorts.** A society, a bootcamp or a university department running a syllabus with target dates, and seeing aggregate progress. Deferred once already, because the self-paced product had to work first.

## Later, and on purpose

- **Projects reviewed by a person**, with structured feedback. The mechanism matters more than the content here, and doing it badly is worse than not doing it.
- **Server-side verification of exercises**, so a pass is checked rather than self-reported. Certificates do not depend on exercise passes alone today.
- **Verified affiliation** on company contributions — a work-email or document check, so a review can be marked as verified rather than unverified.
- **Offline tolerance** for lessons and progress on an unreliable connection.
- **Email digests**, privacy-preserving analytics, and company-to-course cross-links.

## What is not planned

Paid tiers, advertising, selling data, a mobile app before the web app is excellent, and a course catalogue measured by how many courses it has.

## How to change this list

Open an issue or a pull request on [the platform repository](https://github.com/devhelppk/devhelp-platform), or [write a lesson](/contribute). The roadmap is a document in the repository, so changing it is a pull request like anything else.

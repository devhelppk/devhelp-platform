import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@repo/ui/components/button";

export const metadata: Metadata = {
  title: "Contribute",
  description:
    "Three ways to help: write or fix a lesson, work on the platform, or mentor. What each one involves and where to start.",
  alternates: { canonical: "/contribute" },
};

const CONTENT_REPO = "https://github.com/devhelppk/devhelp-content";
const PLATFORM_REPO = "https://github.com/devhelppk/devhelp-platform";

export default function ContributePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">
        Contribute
      </h1>
      <p className="mt-6 max-w-prose text-lg text-muted-foreground">
        Everything here is built in the open by people who wanted it to exist.
        There are three doors, and you do not need to be an expert to walk
        through any of them — a fixed typo in a lesson is a real contribution.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Door
          title="Write or fix a lesson"
          repo="devhelppk/devhelp-content"
          href={CONTENT_REPO}
          licence="CC BY-SA 4.0"
        >
          <p>
            Lessons are MDX, quizzes and exercises are YAML and test files. A
            correction is a pull request; a new module is a pull request with
            more in it. <code>pnpm content:check</code> runs the same validation
            our CI does — schema, links, quiz answers, and your exercise&apos;s
            tests against your own solution — so you can see it pass before you
            open anything.
          </p>
          <p>
            The most useful contribution is not a new course. It is a scenario:
            a realistic way a working system breaks, with the repository that
            breaks that way.
          </p>
        </Door>

        <Door
          title="Work on the platform"
          repo="devhelppk/devhelp-platform"
          href={PLATFORM_REPO}
          licence="MIT"
        >
          <p>
            Next.js, TypeScript, Postgres and Drizzle in a Turborepo. It runs
            end to end on a laptop with Docker and no paid keys: clone it,
            <code>pnpm install</code>, then{" "}
            <code>
              pnpm db:up &amp;&amp; pnpm db:migrate &amp;&amp; pnpm db:seed
            </code>
            , then <code>pnpm dev</code>. The app comes up with real seeded
            content.
          </p>
          <p>
            Every decision of consequence is written down in <code>docs/</code>{" "}
            with the reasoning and what was abandoned, so you can find out why
            something is the way it is before you change it.
          </p>
        </Door>
      </div>

      <section className="mt-12 flex flex-col gap-4 rounded-lg border p-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Mentor
        </h2>
        <p className="max-w-prose text-muted-foreground">
          Mentors review what learners submit, write and edit lessons, and keep
          the company bank honest. It is an application, and an admin reads it:
          we are looking for people who have shipped software professionally and
          can explain why something is wrong without making anyone feel small.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/mentor/apply">Apply to mentor</Link>
          </Button>
        </div>
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          One thing that surprises people
        </h2>
        <p className="max-w-prose text-muted-foreground">
          The content repository owns <strong>what a lesson is</strong> — its
          words, its quiz, its exercise, its structure. The platform owns{" "}
          <strong>how it is described</strong> — titles, summaries, levels,
          durations, cover images and credits, which mentors edit in the app.
          Putting a <code>title:</code> back into a lesson file fails the
          content check with a message telling you where it went. The reason:
          fixing a typo in a title should not need a pull request, a review and
          a deploy, while changing what a lesson teaches should need all three.
        </p>
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Contributing to the company bank
        </h2>
        <p className="max-w-prose text-muted-foreground">
          You do not need a pull request for this one. Sign in, verify your
          email, and write about a company you have worked at or interviewed
          with. It publishes anonymously after a moderator reads it against the{" "}
          <Link href="/policy" className="underline underline-offset-4">
            content policy
          </Link>
          . One experience is also what opens the rest of the bank for you for a
          year.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/companies">Find a company</Link>
          </Button>
        </div>
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          How we work
        </h2>
        <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-muted-foreground">
          <li>
            A pull request needs one review. Be blunt about code and kind about
            people.
          </li>
          <li>
            Explain <em>why</em> in the commit message and in the code. A
            comment that says what the next person would have got wrong is worth
            more than one that repeats the line below it.
          </li>
          <li>
            <code>
              pnpm format &amp;&amp; pnpm lint &amp;&amp; pnpm check-types
              &amp;&amp; pnpm test &amp;&amp; pnpm build
            </code>{" "}
            passes before you ask for a review.
          </li>
          <li>
            Found a security problem? Write to{" "}
            <a
              href="mailto:policy@devhelp.pk"
              className="underline underline-offset-4"
            >
              policy@devhelp.pk
            </a>{" "}
            before opening an issue.
          </li>
        </ul>
      </section>
    </main>
  );
}

function Door({
  title,
  repo,
  href,
  licence,
  children,
}: {
  title: string;
  repo: string;
  href: string;
  licence: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">Licensed {licence}</p>
      </div>
      <div className="flex flex-col gap-3 text-sm text-muted-foreground">
        {children}
      </div>
      <a href={href} className="text-sm underline underline-offset-4">
        {repo}
      </a>
    </section>
  );
}

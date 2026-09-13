import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@repo/ui/components/button";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why devhelp exists: the gap between a Pakistani CS degree and a modern engineering job, and what a free, open-source platform can do about it.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">
        Why this exists
      </h1>

      <div className="mt-8 flex flex-col gap-6 text-lg">
        <p>
          Pakistan graduates tens of thousands of computer science students a
          year. The industry they are graduating into moved again in 2026: code
          is cheap to generate and expensive to be responsible for, and the work
          that is left is reading systems you did not write, deciding what is
          correct, and saying so clearly to people in another timezone.
        </p>
        <p className="text-muted-foreground">
          That is not a complaint about universities. A degree teaches you
          computer science, and it should. What is missing is the semester
          nobody runs: the one where you work inside a codebase that already
          exists, under a problem that is already happening, with the habits
          that make you useful in a team. devhelp is an attempt at that
          semester, free, for anyone.
        </p>
      </div>

      <Section title="Who it is for">
        <p>
          The final-year student with a degree and no production experience. The
          fresh graduate whose interviews keep ending at the take-home. The
          engineer two years in who is good at shipping features and was never
          taught how to debug something they did not write, how to argue for a
          trade-off in writing, or what they should be paid.
        </p>
        <p>
          No fees and no application. Whatever your university, wherever you
          are.
        </p>
      </Section>

      <Section title="What we think teaching should look like">
        <ul className="flex list-disc flex-col gap-3 pl-5">
          <li>
            <strong>The unit of learning is a failure.</strong> Not a feature
            built from an empty folder, but a working system that breaks —
            because that is the shape of every real ticket.
          </li>
          <li>
            <strong>Judgement over recall.</strong> The debrief on an exercise
            asks what failed, what pattern it belongs to, what the trade-off
            was, and what should make you look for it next time.
          </li>
          <li>
            <strong>A stated position on AI.</strong> Every lesson says whether
            you should use it. Pretending it does not exist teaches nothing;
            letting it write everything teaches less.
          </li>
          <li>
            <strong>A small catalogue.</strong> Finishing it should mean
            something. Twenty-five shallow courses mean nothing.
          </li>
          <li>
            <strong>Communication counts as engineering.</strong> Offshore hires
            usually fail on writing and clarity, not on code, so that is a track
            and not an afterthought.
          </li>
        </ul>
      </Section>

      <Section title="The company bank">
        <p>
          Deciding where to work is half of an early career, and in Pakistan the
          information to decide with barely exists. So the platform has a second
          half: reviews, interview experiences and real pay for software
          employers here, written by the people who worked there, published
          anonymously after a moderator reads them.
        </p>
        <p className="text-muted-foreground">
          It is give-to-get — contribute one experience to read the rest —
          because a bank like this either belongs to the people who build it or
          it gets harvested by everyone except them. Pay appears only as
          aggregates with a floor of five reports per role, so no
          individual&apos;s salary can be read off a page.
        </p>
      </Section>

      <Section title="How it is built">
        <p>
          In public, in two repositories, by whoever shows up. The curriculum is
          CC BY-SA 4.0 and the platform is MIT. Every architectural decision is
          written down in the repository with the reasoning and the things that
          were tried and abandoned — including the ones that were wrong.
        </p>
        <p>
          The whole platform runs on a laptop with Docker and no paid keys,
          which is a deliberate constraint: a university department or a student
          society should be able to run their own copy without a budget or a
          conversation with us.
        </p>
      </Section>

      <Section title="What it will never do">
        <p>
          Charge for the curriculum. Run advertising. Sell data about learners
          or contributors. Put a course behind a certificate paywall. Email you
          anything you did not ask for — the platform sends transactional mail
          only, and badges are announced in the app.
        </p>
      </Section>

      <Section title="Who is behind it">
        <p>
          devhelp is a small open-source project, started and maintained by
          engineers in Pakistan, with mentors contributing lessons and reviews.
          If you want to be one of them, that door is{" "}
          <Link href="/contribute" className="underline underline-offset-4">
            open
          </Link>
          . For anything else, write to{" "}
          <a
            href="mailto:policy@devhelp.pk"
            className="underline underline-offset-4"
          >
            policy@devhelp.pk
          </a>
          .
        </p>
      </Section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button size="lg" asChild>
          <Link href="/courses">See the courses</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/roadmap">What is next</Link>
        </Button>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 flex flex-col gap-4">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
